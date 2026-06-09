-- Drop existing policies first (they may exist from auto-setup)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END;
$$;

-- RLS Policies: Profiles
CREATE POLICY "profiles select self or budget peer" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR app_private.shares_budget((SELECT auth.uid()), id));
CREATE POLICY "profiles update own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- RLS Policies: Budget Periods
CREATE POLICY "budgets select if access" ON public.budget_periods
  FOR SELECT TO authenticated
  USING (app_private.has_budget_access(id, 'viewer', (SELECT auth.uid())));
CREATE POLICY "budgets insert for authenticated owner" ON public.budget_periods
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id IS NOT NULL AND owner_user_id = (SELECT auth.uid()));
CREATE POLICY "budgets update if owner" ON public.budget_periods
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "budgets delete if owner" ON public.budget_periods
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

-- RLS Policies: Budget Collaborators
CREATE POLICY "collab select own or owner" ON public.budget_collaborators
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR app_private.is_budget_owner(budget_period_id, (SELECT auth.uid())));
CREATE POLICY "collab insert if owner" ON public.budget_collaborators
  FOR INSERT TO authenticated
  WITH CHECK (app_private.is_budget_owner(budget_period_id, (SELECT auth.uid())));
CREATE POLICY "collab update if owner" ON public.budget_collaborators
  FOR UPDATE TO authenticated
  USING (app_private.is_budget_owner(budget_period_id, (SELECT auth.uid())))
  WITH CHECK (app_private.is_budget_owner(budget_period_id, (SELECT auth.uid())));
CREATE POLICY "collab update self status" ON public.budget_collaborators
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "collab delete if owner" ON public.budget_collaborators
  FOR DELETE TO authenticated
  USING (app_private.is_budget_owner(budget_period_id, (SELECT auth.uid())));

-- RLS Policies: Categories
CREATE POLICY "categories self" ON public.categories FOR ALL TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

-- RLS Policies: PICs
CREATE POLICY "pics self" ON public.pics FOR ALL TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

-- RLS Policies: Budget Items
CREATE POLICY "items select viewer" ON public.budget_items
  FOR SELECT TO authenticated
  USING (app_private.has_budget_access(budget_period_id, 'viewer', (SELECT auth.uid())));
CREATE POLICY "items insert owner" ON public.budget_items
  FOR INSERT TO authenticated
  WITH CHECK (app_private.is_budget_owner(budget_period_id, (SELECT auth.uid())));
CREATE POLICY "items update owner" ON public.budget_items
  FOR UPDATE TO authenticated
  USING (app_private.is_budget_owner(budget_period_id, (SELECT auth.uid())))
  WITH CHECK (app_private.is_budget_owner(budget_period_id, (SELECT auth.uid())));
CREATE POLICY "items delete owner" ON public.budget_items
  FOR DELETE TO authenticated
  USING (app_private.is_budget_owner(budget_period_id, (SELECT auth.uid())));

-- RLS Policies: Transactions
CREATE POLICY "tx select viewer" ON public.transactions
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()) OR (budget_period_id IS NOT NULL AND app_private.has_budget_access(budget_period_id, 'viewer', (SELECT auth.uid()))));
CREATE POLICY "tx insert collab" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND (budget_period_id IS NULL OR app_private.has_budget_access(budget_period_id, 'collaborator', (SELECT auth.uid()))));
CREATE POLICY "tx update own or owner" ON public.transactions
  FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR (budget_period_id IS NOT NULL AND app_private.is_budget_owner(budget_period_id, (SELECT auth.uid()))))
  WITH CHECK (created_by = (SELECT auth.uid()) OR (budget_period_id IS NOT NULL AND app_private.is_budget_owner(budget_period_id, (SELECT auth.uid()))));
CREATE POLICY "tx delete own or owner" ON public.transactions
  FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR (budget_period_id IS NOT NULL AND app_private.is_budget_owner(budget_period_id, (SELECT auth.uid()))));

-- RLS Policies: Notifications
CREATE POLICY "notif select own" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif update own" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif delete own" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());