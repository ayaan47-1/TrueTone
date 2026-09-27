-- 0023_revoke_client_mutation_grants.sql
-- consent_log and scans are append-only for clients. RLS already has no UPDATE/DELETE
-- policy on either table (and consent_log has an immutability trigger), so a client
-- UPDATE/DELETE touches zero rows today. But Supabase's default privileges still grant
-- anon/authenticated UPDATE, DELETE and TRUNCATE on every public table, so a client
-- statement is silently accepted instead of refused. Revoke them so the privilege layer
-- refuses the statement outright (42501), as the pgTAP suite expects.
--
-- No app path needs these grants: the client only SELECTs these tables (src/lib/scans.ts,
-- routine-chat Edge Function) and every server-side writer is SECURITY DEFINER
-- (record_scan, set_routine_feedback, delete_my_data, purge_scans_on_consent_withdrawn,
-- the retention job). INSERT on consent_log stays granted to authenticated (0002).

revoke update, delete, truncate on public.consent_log from anon, authenticated;
revoke update, delete, truncate on public.scans from anon, authenticated;
