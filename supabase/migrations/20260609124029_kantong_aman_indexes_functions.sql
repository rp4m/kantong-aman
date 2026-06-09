-- Indexes (idempotent with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_budget_periods_owner ON public.budget_periods (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_collab_unique ON public.budget_collaborators (budget_period_id, lower(invited_email));
CREATE INDEX IF NOT EXISTS idx_collab_user ON public.budget_collaborators (user_id);
CREATE INDEX IF NOT EXISTS idx_collab_email ON public.budget_collaborators (lower(invited_email));
CREATE INDEX IF NOT EXISTS idx_collab_budget ON public.budget_collaborators (budget_period_id);
CREATE INDEX IF NOT EXISTS idx_categories_owner ON public.categories (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_pics_owner ON public.pics (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_items_budget ON public.budget_items (budget_period_id);
CREATE INDEX IF NOT EXISTS idx_tx_budget ON public.transactions (budget_period_id);
CREATE INDEX IF NOT EXISTS idx_tx_date ON public.transactions (date);
CREATE INDEX IF NOT EXISTS idx_tx_created_by ON public.transactions (created_by);
CREATE INDEX IF NOT EXISTS idx_notif_user ON public.notifications (user_id, created_at DESC);

-- Grants
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_periods TO authenticated;
GRANT ALL ON public.budget_periods TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_collaborators TO authenticated;
GRANT ALL ON public.budget_collaborators TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pics TO authenticated;
GRANT ALL ON public.pics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_items TO authenticated;
GRANT ALL ON public.budget_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- Helper Functions (app_private schema)
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT USAGE ON SCHEMA app_private TO service_role;

CREATE OR REPLACE FUNCTION app_private.is_budget_owner(_budget_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.budget_periods
    WHERE id = _budget_id AND owner_user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION app_private.has_budget_access(_budget_id UUID, _min_role public.collab_role, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION app_private.shares_budget(_a UUID, _b UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
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