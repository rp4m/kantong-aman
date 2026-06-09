DROP POLICY IF EXISTS "budgets insert as self" ON public.budget_periods;

CREATE POLICY "budgets insert for authenticated owner"
ON public.budget_periods
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id IS NOT NULL
  AND owner_user_id = (select auth.uid())
);

GRANT EXECUTE ON FUNCTION public.has_budget_access(uuid, public.collab_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_budget_owner(uuid, uuid) TO authenticated;