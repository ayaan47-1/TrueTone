-- Allergen P1: wa_health consent receipts (design §2.4). Separate from the biometric consent.
begin;
select plan(9);
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
select is(
  (select count(*) from public.consent_log where user_id = '77777777-7777-7777-7777-777777777777')::int,
  0, 'receipt is scoped to the caller only');
select throws_ok(
  $$ update public.consent_log set action = 'withdrawn'
       where user_id = '66666666-6666-6666-6666-666666666666' $$,
  'P0001', 'consent_log is append-only', 'append-only holds for wa_health receipts');
select public.withdraw_health_data_consent();
select is(
  (select count(*) from public.consent_log
     where user_id = '66666666-6666-6666-6666-666666666666' and action = 'withdrawn'
       and policy_doc_key = 'wa_health')::int,
  1, 'withdraw logs a wa_health row');

set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok($$ select public.record_health_data_consent() $$, 'P0001', 'not authenticated',
  'unauthenticated callers are refused');
select * from finish();
rollback;
