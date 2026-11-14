-- Match the accepted owner-only maintenance contract on fresh installations.
-- Cron jobs and SECURITY DEFINER callers execute as their existing owners.
-- 0032 already removed PUBLIC/anon/authenticated access; remove the remaining
-- default service-role grant without changing ownership, bodies or schedules.
-- Repeating REVOKE is safe, including where this privilege is already absent.
revoke execute on function public.audit_deletion(text, uuid),
  public.truetone_reconcile_deletions(),
  public.truetone_retention_sweep(),
  public.waitlist_retention_sweep(),
  public.gen_waitlist_code()
from service_role;
