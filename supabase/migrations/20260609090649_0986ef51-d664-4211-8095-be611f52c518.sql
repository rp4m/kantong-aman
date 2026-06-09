
-- 1) Profiles: restrict SELECT to self + budget-shared users
DROP POLICY IF EXISTS "profiles select all authenticated" ON public.profiles;

CREATE OR REPLACE FUNCTION app_private.shares_budget(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.budget_periods bp
    LEFT JOIN public.budget_collaborators bc ON bc.budget_period_id = bp.id
    WHERE (bp.owner_user_id = _a AND (bc.user_id = _b OR bp.owner_user_id = _b))
       OR (bp.owner_user_id = _b AND (bc.user_id = _a OR bp.owner_user_id = _a))
       OR (bc.user_id = _a AND EXISTS (
            SELECT 1 FROM public.budget_collaborators bc2
            WHERE bc2.budget_period_id = bp.id AND bc2.user_id = _b))
  );
$$;

CREATE POLICY "profiles select self or budget peer" ON public.profiles
FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) OR app_private.shares_budget((SELECT auth.uid()), id));

-- 2) Collaborators: prevent privilege escalation via self-update
DROP POLICY IF EXISTS "collab update if owner or self" ON public.budget_collaborators;

CREATE POLICY "collab update if owner" ON public.budget_collaborators
FOR UPDATE TO authenticated
USING (app_private.is_budget_owner(budget_period_id, (SELECT auth.uid())))
WITH CHECK (app_private.is_budget_owner(budget_period_id, (SELECT auth.uid())));

-- Self-updates are limited: only accept/reject own invitation, no role/user_id/budget changes
CREATE OR REPLACE FUNCTION public.tg_collab_self_update_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF app_private.is_budget_owner(NEW.budget_period_id, auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.budget_period_id IS DISTINCT FROM OLD.budget_period_id
     OR NEW.invited_email IS DISTINCT FROM OLD.invited_email THEN
    RAISE EXCEPTION 'collaborators cannot modify role or assignment';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS collab_self_update_guard ON public.budget_collaborators;
CREATE TRIGGER collab_self_update_guard
BEFORE UPDATE ON public.budget_collaborators
FOR EACH ROW EXECUTE FUNCTION public.tg_collab_self_update_guard();

CREATE POLICY "collab update self status" ON public.budget_collaborators
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- 3) Realtime: restrict channel subscriptions to user's own notification topic
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime own notif channel" ON realtime.messages;
CREATE POLICY "realtime own notif channel" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.topic() = 'notif-' || (SELECT auth.uid())::text
);
