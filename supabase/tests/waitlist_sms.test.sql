-- supabase/tests/waitlist_sms.test.sql
-- pgTAP coverage for 0016_waitlist_sms: phone capture and TCPA consent proof.
--
-- The waitlist holds an email address and now a phone number — never biometric or skin
-- data. It stays outside the compliance boundary in CLAUDE.md §3. Retention still applies.
begin;
select plan(25);

-- ── shape ─────────────────────────────────────────────────────────────────────
select has_column('public', 'waitlist', 'phone', 'waitlist carries a phone column');
select has_column('public', 'waitlist', 'sms_consent_at', 'waitlist records when SMS consent was given');
select has_column('public', 'waitlist', 'sms_consent_version', 'waitlist records which wording was consented to');
select has_column('public', 'waitlist', 'sms_invited_at', 'waitlist has the send-project idempotency seam');
select has_table('public', 'waitlist_sms_events', 'the consent event log exists');
select has_table('public', 'waitlist_sms_consent_versions', 'the consent wording table exists');
select has_table('public', 'waitlist_secrets', 'the pepper table exists');
select is((select relrowsecurity from pg_class where relname = 'waitlist_secrets'), true,
  'RLS enabled on waitlist_secrets');

-- ── no client role may read any of it: full anon/authenticated/service_role matrix ────
-- waitlist_sms_events and waitlist_sms_consent_versions each grant SELECT to service_role
-- only (so the send-project and any future read path can find receipts); waitlist_secrets
-- grants nothing to anyone, ever.
select table_privs_are('public', 'waitlist_sms_events', 'anon', '{}',
  'anon holds no privileges on the event log');
select table_privs_are('public', 'waitlist_sms_events', 'authenticated', '{}',
  'authenticated holds no privileges on the event log');
select table_privs_are('public', 'waitlist_sms_events', 'service_role', '{SELECT}',
  'service_role can only read the event log');

select table_privs_are('public', 'waitlist_sms_consent_versions', 'anon', '{}',
  'anon holds no privileges on the consent wording table');
select table_privs_are('public', 'waitlist_sms_consent_versions', 'authenticated', '{}',
  'authenticated holds no privileges on the consent wording table');
select table_privs_are('public', 'waitlist_sms_consent_versions', 'service_role', '{SELECT}',
  'service_role can only read the consent wording table');

select table_privs_are('public', 'waitlist_secrets', 'anon', '{}',
  'anon holds no privileges on the pepper table');
select table_privs_are('public', 'waitlist_secrets', 'authenticated', '{}',
  'authenticated holds no privileges on the pepper table');
select table_privs_are('public', 'waitlist_secrets', 'service_role', '{}',
  'even service_role cannot read the pepper');

-- ── phone format: E.164 US, excluding N11 service codes ───────────────────────
select throws_ok(
  $$ insert into public.waitlist(email, attested_18_us, phone, sms_consent_at, sms_consent_version)
     values ('a@example.com', true, '+19115550100', now(), 'sms-2026-08-07') $$,
  '23514', null, '911 is rejected as an area code');
select throws_ok(
  $$ insert into public.waitlist(email, attested_18_us, phone, sms_consent_at, sms_consent_version)
     values ('b@example.com', true, '+12124115100', now(), 'sms-2026-08-07') $$,
  '23514', null, '411 is rejected as an exchange');
select throws_ok(
  $$ insert into public.waitlist(email, attested_18_us, phone, sms_consent_at, sms_consent_version)
     values ('d@example.com', true, '+442071234567', now(), 'sms-2026-08-07') $$,
  '23514', null, 'a non-US number is rejected');

-- ── a number and its consent record are inseparable ───────────────────────────
select throws_ok(
  $$ insert into public.waitlist(email, attested_18_us, phone)
     values ('c@example.com', true, '+12125550100') $$,
  '23514', null, 'a phone with no consent record is rejected');

-- ── the event log is append-only ──────────────────────────────────────────────
insert into public.waitlist_sms_events(phone_hash, event) values ('deadbeef', 'granted');
select throws_ok(
  $$ update public.waitlist_sms_events set event = 'revoked' where phone_hash = 'deadbeef' $$,
  'P0001', null, 'the event log cannot be updated');
select throws_ok(
  $$ delete from public.waitlist_sms_events where phone_hash = 'deadbeef' $$,
  'P0001', null, 'the event log cannot be deleted from');

-- ── the consent wording table is append-only too ──────────────────────────────
-- Same guarantee as the event log: the wording is a legal record, so a copy-paste that
-- pointed a trigger at the wrong table, or dropped it in a later migration, must fail loudly.
select throws_ok(
  $$ update public.waitlist_sms_consent_versions set body = 'changed' where version = 'sms-2026-08-07' $$,
  'P0001', null, 'the consent wording cannot be updated');
select throws_ok(
  $$ delete from public.waitlist_sms_consent_versions where version = 'sms-2026-08-07' $$,
  'P0001', null, 'the consent wording cannot be deleted from');

select * from finish();
rollback;
