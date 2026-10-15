-- 0030_revoke_client_mutation_grants.sql
-- Public tables must expose only the client privileges the app actually uses. Row-level
-- security already rejects the writes below, but Supabase's default table privileges grant
-- them to anon/authenticated unless a migration explicitly revokes them. In particular,
-- 0002 described retention_runs as having no client grants without first removing those
-- defaults. Close that gap here rather than editing the already-applied migration.
--
-- The app writes profiles only through its authenticated username/avatar column grant.
-- record_scan, set_routine_feedback, consent RPCs, deletion RPCs, and retention work run
-- through SECURITY DEFINER functions owned by the migration role. service_role privileges
-- are intentionally untouched.

revoke all on public.retention_runs, public.deletion_audit from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
  on public.policy_versions
  from anon, authenticated;

revoke delete, truncate, references, trigger
  on public.profiles
  from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
  on public.consent_log, public.scans
  from anon, authenticated;
