-- supabase/tests/waitlist_sms.test.sql
-- pgTAP coverage for 0016_waitlist_sms: phone capture and TCPA consent proof.
--
-- The waitlist holds an email address and now a phone number — never biometric or skin
-- data. It stays outside the compliance boundary in CLAUDE.md §3. Retention still applies.
begin;
select plan(39);

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

-- ── nor may any client role execute the helpers ────────────────────────────────
-- Without this, a future migration granting execute on waitlist_phone_hash to anon would
-- turn it into a phone-number oracle: submit a guess, compare the digest against the event
-- log. Neither helper needs to be callable by anything but a security-definer RPC.
select function_privs_are('public', 'normalize_us_phone', ARRAY['text'], 'anon', '{}',
  'anon holds no privileges on normalize_us_phone');
select function_privs_are('public', 'normalize_us_phone', ARRAY['text'], 'authenticated', '{}',
  'authenticated holds no privileges on normalize_us_phone');
select function_privs_are('public', 'normalize_us_phone', ARRAY['text'], 'service_role', '{}',
  'service_role holds no privileges on normalize_us_phone');
select function_privs_are('public', 'waitlist_phone_hash', ARRAY['text'], 'anon', '{}',
  'anon holds no privileges on waitlist_phone_hash');
select function_privs_are('public', 'waitlist_phone_hash', ARRAY['text'], 'authenticated', '{}',
  'authenticated holds no privileges on waitlist_phone_hash');
select function_privs_are('public', 'waitlist_phone_hash', ARRAY['text'], 'service_role', '{}',
  'service_role holds no privileges on waitlist_phone_hash');

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

-- ── normalization ─────────────────────────────────────────────────────────────
select is(public.normalize_us_phone('(212) 555-0100'), '+12125550100',
  'punctuation and spaces are stripped');
select is(public.normalize_us_phone('12125550100'), '+12125550100',
  'a leading 1 is read as the country code, not a digit');
select is(public.normalize_us_phone('+1 212 555 0100'), '+12125550100',
  'an already-E.164 number round-trips');
select is(public.normalize_us_phone('212555010'), null,
  'nine digits is not a US number');
select is(public.normalize_us_phone('+442071838750'), null,
  'a non-US number is rejected rather than mangled');

-- ── hashing ───────────────────────────────────────────────────────────────────
-- Two spellings of one number must land on the same hash or dedup and lookup both break.
select is(
  public.waitlist_phone_hash(public.normalize_us_phone('(212) 555-0100')),
  public.waitlist_phone_hash(public.normalize_us_phone('212.555.0100')),
  'the same number in two formats hashes identically');

-- A stub that ignored its argument and returned a constant would pass the equality test
-- above; this rules that out.
select isnt(
  public.waitlist_phone_hash(public.normalize_us_phone('(212) 555-0100')),
  public.waitlist_phone_hash(public.normalize_us_phone('(212) 555-0199')),
  'different numbers hash differently');

-- The missing-pepper guard is the whole reason for the explicit check: without it, a missing
-- pepper would hash with a null and produce brute-forceable digests indistinguishable from
-- good ones. Run last among the hash assertions and restore the row immediately after, since
-- the rest of this transaction still needs a working waitlist_phone_hash.
delete from public.waitlist_secrets where name = 'sms_pepper';
select throws_ok(
  $$ select public.waitlist_phone_hash('+12125550100') $$,
  'P0001', null, 'waitlist_phone_hash raises when the pepper is missing');
insert into public.waitlist_secrets(name, value)
values ('sms_pepper', encode(gen_random_bytes(32), 'hex'));

select * from finish();
rollback;
