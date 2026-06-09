GRANT EXECUTE ON FUNCTION public.has_budget_access(uuid, public.collab_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_budget_owner(uuid, uuid) TO authenticated;