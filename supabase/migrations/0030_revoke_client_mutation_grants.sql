-- 0030_revoke_client_mutation_grants.sql
-- consent_log and scans are append-only for clients. Row-level security already has no
-- UPDATE or DELETE policy on either table, and consent_log also has an immutability trigger.
-- Even so, Supabase's default table privileges let anon/authenticated submit UPDATE,
-- DELETE, and TRUNCATE statements that succeed against zero rows. Revoke those privileges
-- so the privilege layer rejects direct client mutation outright (42501).
--
-- No app path needs these grants: clients read the tables, while record_scan,
-- set_routine_feedback, consent RPCs, deletion RPCs, and retention work run through
-- SECURITY DEFINER functions owned by the migration role.

revoke update, delete, truncate on public.consent_log from anon, authenticated;
revoke update, delete, truncate on public.scans from anon, authenticated;
