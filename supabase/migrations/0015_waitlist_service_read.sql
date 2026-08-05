-- supabase/migrations/0015_waitlist_service_read.sql
-- Make the waitlist readable server-side.
--
-- 0014 revoked every table privilege so the signup form could never be used to read the
-- list. On a project created with "automatically expose new tables" turned off, that left
-- the table unreadable by service_role too — correct for anon, but it also meant nothing
-- could ever read the list to send the invites it exists to collect.
--
-- service_role is the server-side key: it is never shipped to a client and never reaches
-- the browser bundle (web/config.js carries only the anon key). Granting it here changes
-- nothing about what an anon visitor can do.
--
-- SELECT + UPDATE only. UPDATE is what stamps invited_at when an invite goes out.
-- DELETE stays revoked: rows leave via leave_waitlist() (the user's own unsubscribe) or
-- waitlist_retention_sweep(), so a stray backend call cannot quietly drop signups.

-- Revoke first so the result is identical whether or not the project was created with
-- "automatically expose new tables" on. Without this, a default-settings project leaves
-- service_role holding TRUNCATE — enough to wipe the whole list in one statement.
revoke all on public.waitlist from service_role;
grant select, update on public.waitlist to service_role;

comment on table public.waitlist is
  'Pre-launch email waitlist. No biometric or skin data. anon may only call join_waitlist()/leave_waitlist(); service_role may read and stamp invited_at.';
