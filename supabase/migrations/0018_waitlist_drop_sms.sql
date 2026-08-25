-- supabase/migrations/0018_waitlist_drop_sms.sql
-- Remove the dormant SMS schema that 0016 added.
--
-- WHY: the shade-match pivot dropped SMS entirely. The marketing page (web/) collects an
-- email plus an optional referral code + UTM source only — there is no phone field, no
-- TCPA consent capture, and no SMS send path anywhere (see web/waitlist-client.js and
-- 0017). SMS never went live, so everything 0016 added for phone capture is dormant in
-- prod: zero rows collected, no writer, no reader. This migration removes it forward-only
-- (0016 stays in history as applied; 0018 reverses its schema).
--
-- ORDER MATTERS. 0016 also rewrote two CORE, still-live functions to write/prune the SMS
-- event log, and 0017 never reverted them, so the versions live in prod today still
-- reference waitlist_sms_events:
--   • leave_waitlist()            — the one-tap unsubscribe
--   • waitlist_retention_sweep()  — the nightly cron `truetone-waitlist-retention`
-- We therefore RESTORE both to their SMS-free 0014 form FIRST, so that dropping the SMS
-- tables cannot break unsubscribe or the retention cron. The cron itself is unchanged:
-- it calls public.waitlist_retention_sweep() by name, and we keep the name + signature,
-- so we do NOT re-schedule it here (that would duplicate the job).

-- ── 1. restore leave_waitlist + waitlist_retention_sweep to their SMS-free 0014 form ──
create or replace function public.leave_waitlist(p_token uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- No-op on an unknown token, for the same non-enumeration reason as join_waitlist.
  delete from public.waitlist where unsubscribe_token = p_token;
end; $$;

revoke all on function public.leave_waitlist(uuid) from public;
grant execute on function public.leave_waitlist(uuid) to anon, authenticated;

create or replace function public.waitlist_retention_sweep()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.waitlist
  where (invited_at is not null and invited_at < now() - interval '90 days')
     or created_at < now() - interval '3 years';
end; $$;

revoke all on function public.waitlist_retention_sweep() from public;

-- ── 2. drop the phone helper functions (now unreferenced once the above are restored) ──
drop function if exists public.waitlist_phone_hash(text);
drop function if exists public.normalize_us_phone(text);

-- ── 3. drop the SMS columns on waitlist ──
-- Dropping these columns cascades away everything 0016 hung on them: the phone CHECK
-- constraints (waitlist_phone_e164, waitlist_phone_consent_paired), the partial unique
-- index (waitlist_phone_key), and the consent-version FK (waitlist_sms_consent_version_fk).
alter table public.waitlist
  drop column if exists sms_invited_at,
  drop column if exists sms_consent_version,
  drop column if exists sms_consent_at,
  drop column if exists phone;

-- ── 4. drop the SMS tables (their append-only triggers go with them) ──
drop table if exists public.waitlist_sms_events;
drop table if exists public.waitlist_sms_consent_versions;
drop table if exists public.waitlist_secrets;

-- ── 5. drop the trigger-guard functions (their triggers were dropped with the tables) ──
drop function if exists public.block_waitlist_sms_event_mutation();
drop function if exists public.block_consent_version_mutation();
