CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT USAGE ON SCHEMA app_private TO service_role;

CREATE OR REPLACE FUNCTION app_private.is_budget_owner(_budget_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.budget_periods
    WHERE id = _budget_id
      AND owner_user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION app_private.has_budget_access(_budget_id UUID, _min_role public.collab_role, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH r AS (
    SELECT CASE _min_role WHEN 'viewer' THEN 1 WHEN 'collaborator' THEN 2 WHEN 'owner' THEN 3 END AS need
  ),
  a AS (
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM public.budget_periods WHERE id = _budget_id AND owner_user_id = _user_id) THEN 3
      ELSE COALESCE((
        SELECT CASE role WHEN 'owner' THEN 3 WHEN 'collaborator' THEN 2 WHEN 'viewer' THEN 1 END
        FROM public.budget_collaborators
        WHERE budget_period_id = _budget_id AND user_id = _user_id AND status = 'accepted'
        LIMIT 1
      ), 0)
    END AS lvl
  )
  SELECT a.lvl >= r.need FROM r, a;
$$;

REVOKE ALL ON FUNCTION app_private.is_budget_owner(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.has_budget_access(UUID, public.collab_role, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.is_budget_owner(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.has_budget_access(UUID, public.collab_role, UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "budgets select if access" ON public.budget_periods;
CREATE POLICY "budgets select if access" ON public.budget_periods
FOR SELECT TO authenticated
USING (app_private.has_budget_access(id, 'viewer', (select auth.uid())));

DROP POLICY IF EXISTS "collab select own or owner" ON public.budget_collaborators;
CREATE POLICY "collab select own or owner" ON public.budget_collaborators
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()) OR app_private.is_budget_owner(budget_period_id, (select auth.uid())));

DROP POLICY IF EXISTS "collab insert if owner" ON public.budget_collaborators;
CREATE POLICY "collab insert if owner" ON public.budget_collaborators
FOR INSERT TO authenticated
WITH CHECK (app_private.is_budget_owner(budget_period_id, (select auth.uid())));

DROP POLICY IF EXISTS "collab update if owner or self" ON public.budget_collaborators;
CREATE POLICY "collab update if owner or self" ON public.budget_collaborators
FOR UPDATE TO authenticated
USING (app_private.is_budget_owner(budget_period_id, (select auth.uid())) OR user_id = (select auth.uid()))
WITH CHECK (app_private.is_budget_owner(budget_period_id, (select auth.uid())) OR user_id = (select auth.uid()));

DROP POLICY IF EXISTS "collab delete if owner" ON public.budget_collaborators;
CREATE POLICY "collab delete if owner" ON public.budget_collaborators
FOR DELETE TO authenticated
USING (app_private.is_budget_owner(budget_period_id, (select auth.uid())));

DROP POLICY IF EXISTS "items select viewer" ON public.budget_items;
CREATE POLICY "items select viewer" ON public.budget_items
FOR SELECT TO authenticated
USING (app_private.has_budget_access(budget_period_id, 'viewer', (select auth.uid())));

DROP POLICY IF EXISTS "items insert owner" ON public.budget_items;
CREATE POLICY "items insert owner" ON public.budget_items
FOR INSERT TO authenticated
WITH CHECK (app_private.is_budget_owner(budget_period_id, (select auth.uid())));

DROP POLICY IF EXISTS "items update owner" ON public.budget_items;
CREATE POLICY "items update owner" ON public.budget_items
FOR UPDATE TO authenticated
USING (app_private.is_budget_owner(budget_period_id, (select auth.uid())))
WITH CHECK (app_private.is_budget_owner(budget_period_id, (select auth.uid())));

DROP POLICY IF EXISTS "items delete owner" ON public.budget_items;
CREATE POLICY "items delete owner" ON public.budget_items
FOR DELETE TO authenticated
USING (app_private.is_budget_owner(budget_period_id, (select auth.uid())));

DROP POLICY IF EXISTS "tx select viewer" ON public.transactions;
CREATE POLICY "tx select viewer" ON public.transactions
FOR SELECT TO authenticated
USING (created_by = (select auth.uid()) OR (budget_period_id IS NOT NULL AND app_private.has_budget_access(budget_period_id, 'viewer', (select auth.uid()))));

DROP POLICY IF EXISTS "tx insert collab" ON public.transactions;
CREATE POLICY "tx insert collab" ON public.transactions
FOR INSERT TO authenticated
WITH CHECK (created_by = (select auth.uid()) AND (budget_period_id IS NULL OR app_private.has_budget_access(budget_period_id, 'collaborator', (select auth.uid()))));

DROP POLICY IF EXISTS "tx update own or owner" ON public.transactions;
CREATE POLICY "tx update own or owner" ON public.transactions
FOR UPDATE TO authenticated
USING (created_by = (select auth.uid()) OR (budget_period_id IS NOT NULL AND app_private.is_budget_owner(budget_period_id, (select auth.uid()))))
WITH CHECK (created_by = (select auth.uid()) OR (budget_period_id IS NOT NULL AND app_private.is_budget_owner(budget_period_id, (select auth.uid()))));

DROP POLICY IF EXISTS "tx delete own or owner" ON public.transactions;
CREATE POLICY "tx delete own or owner" ON public.transactions
FOR DELETE TO authenticated
USING (created_by = (select auth.uid()) OR (budget_period_id IS NOT NULL AND app_private.is_budget_owner(budget_period_id, (select auth.uid()))));

REVOKE EXECUTE ON FUNCTION public.has_budget_access(uuid, public.collab_role, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_budget_owner(uuid, uuid) FROM authenticated;