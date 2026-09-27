-- Allergen P1: wa_health consent receipts (design §2.4). Separate from the biometric consent.
-- Scoping and append-only checks run as the superuser (reset role) so RLS and missing client
-- grants cannot make them pass vacuously or fail for the wrong reason.
begin;
select plan(14);
insert into auth.users(id) values ('66666666-6666-6666-6666-666666666666'), ('77777777-7777-7777-7777-777777777777');
insert into public.profiles(id) values ('66666666-6666-6666-6666-666666666666'), ('77777777-7777-7777-7777-777777777777');

set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';

select lives_ok($$ select public.record_health_data_consent() $$, 'record_health_data_consent runs');
select is(
  (select policy_doc_key || '@' || policy_version from public.consent_log
     where user_id = '66666666-6666-6666-6666-666666666666' and action = 'consented'),
  'wa_health@' || (select version from public.policy_versions where doc_key = 'wa_health' and is_current),
  'receipt pins the current wa_health policy');
select is(
  (select count(*) from public.consent_log
     where user_id = '66666666-6666-6666-6666-666666666666' and policy_doc_key = 'biometric')::int,
  0, 'no biometric receipt is written (never bundled)');
select is(
  (select consent_active from public.profiles where id = '66666666-6666-6666-6666-666666666666'),
  false, 'biometric consent_active is untouched');
select public.record_health_data_consent();
select is(
  (select count(*) from public.consent_log
     where user_id = '66666666-6666-6666-6666-666666666666' and action = 'consented')::int,
  1, 'idempotent while consent is active');

-- scoped to the caller: checked as superuser, where RLS cannot hide another user's rows
reset role;
select is(
  (select count(*) from public.consent_log where user_id = '77777777-7777-7777-7777-777777777777')::int,
  0, 'no receipt is written for any other user');

-- another user cannot read the first user's receipt
set local role authenticated;
set local request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}';
select is(
  (select count(*) from public.consent_log where user_id = '66666666-6666-6666-6666-666666666666')::int,
  0, 'RLS hides another user''s wa_health receipt');
select throws_ok(
  $$ update public.consent_log set action = 'withdrawn' $$,
  '42501', null, 'client role has no UPDATE on consent_log');
select throws_ok(
  $$ delete from public.consent_log $$,
  '42501', null, 'client role has no DELETE on consent_log');

-- append-only holds for wa_health receipts even for a role that could write the table
reset role;
select throws_ok(
  $$ update public.consent_log set action = 'withdrawn'
       where user_id = '66666666-6666-6666-6666-666666666666' and policy_doc_key = 'wa_health' $$,
  'P0001', 'consent_log is append-only', 'wa_health receipt cannot be updated');
select throws_ok(
  $$ delete from public.consent_log
       where user_id = '66666666-6666-6666-6666-666666666666' and policy_doc_key = 'wa_health' $$,
  'P0001', 'consent_log is append-only', 'wa_health receipt cannot be deleted');

set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
select public.withdraw_health_data_consent();
select is(
  (select count(*) from public.consent_log
     where user_id = '66666666-6666-6666-6666-666666666666' and action = 'withdrawn'
       and policy_doc_key = 'wa_health')::int,
  1, 'withdraw logs a wa_health row');

set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok($$ select public.record_health_data_consent() $$, 'P0001', 'not authenticated',
  'unauthenticated callers cannot record');
select throws_ok($$ select public.withdraw_health_data_consent() $$, 'P0001', 'not authenticated',
  'unauthenticated callers cannot withdraw');
select * from finish();
rollback;
