-- Unauthenticated clients need policy text, but never profiles, consent receipts, or scans.
-- Keep policy_versions readable by anon and remove only the leftover sensitive-table defaults.

revoke select on public.consent_log, public.profiles, public.scans from anon;
