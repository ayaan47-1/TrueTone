-- Audit maintenance runs only through owner/definer and service-role paths.
-- Supabase grants functions to its client roles by default, so revoke those
-- explicit grants as well as the grant inherited through PUBLIC.
revoke execute on function public.audit_deletion(text, uuid),
  public.truetone_reconcile_deletions()
from public, anon, authenticated;
