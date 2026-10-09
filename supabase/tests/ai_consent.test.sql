begin;
select plan(27);

insert into auth.users(id) values
  ('27272727-2727-2727-2727-272727272701'),
  ('27272727-2727-2727-2727-272727272702'),
  ('27272727-2727-2727-2727-272727272703'),
  ('27272727-2727-2727-2727-272727272704'),
  ('27272727-2727-2727-2727-272727272705');
insert into public.profiles(id, is_18_plus, consent_active) values
  ('27272727-2727-2727-2727-272727272701', true, true),
  ('27272727-2727-2727-2727-272727272702', true, true),
  ('27272727-2727-2727-2727-272727272703', false, true),
  ('27272727-2727-2727-2727-272727272704', true, false);

set local role anon;
select throws_ok($$ select public.record_ai_consent() $$, '42501', null,
  'anon cannot execute record_ai_consent');
select throws_ok($$ select public.withdraw_ai_consent() $$, '42501', null,
  'anon cannot execute withdraw_ai_consent');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"27272727-2727-2727-2727-272727272703","role":"authenticated"}';
select throws_ok($$ select public.record_ai_consent() $$, 'P0001', null,
  'record_ai_consent rejects a caller without age verification');

set local request.jwt.claims =
  '{"sub":"27272727-2727-2727-2727-272727272704","role":"authenticated"}';
select throws_ok($$ select public.record_ai_consent() $$, 'P0001', null,
  'record_ai_consent rejects a caller without scan consent');

set local request.jwt.claims =
  '{"sub":"27272727-2727-2727-2727-272727272701","role":"authenticated"}';
select throws_ok(
  $$ update public.profiles set ai_consent_active = true
     where id = '27272727-2727-2727-2727-272727272701' $$,
  '42501', null, 'authenticated cannot patch ai_consent_active');

select lives_ok($$ select public.record_ai_consent() $$, 'record_ai_consent runs');
select is(
  (select ai_consent_active from public.profiles
    where id = '27272727-2727-2727-2727-272727272701'),
  true, 'AI consent becomes active');
select is(
  (select count(*) from public.consent_log
    where user_id = '27272727-2727-2727-2727-272727272701'
      and action = 'consented' and policy_doc_key = 'ai_routine_chat')::int,
  1, 'AI consent has its own receipt');

reset role;
select is(
  (select ai_consent_active from public.profiles
    where id = '27272727-2727-2727-2727-272727272702'),
  false, 'record_ai_consent does not activate another user');
select is(
  (select count(*) from public.consent_log
    where user_id = '27272727-2727-2727-2727-272727272702'
      and policy_doc_key = 'ai_routine_chat')::int,
  0, 'record_ai_consent does not write another user receipt');
set local role authenticated;

select public.record_ai_consent();
select is(
  (select count(*) from public.consent_log
    where user_id = '27272727-2727-2727-2727-272727272701'
      and action = 'consented' and policy_doc_key = 'ai_routine_chat')::int,
  1, 'AI re-consent is idempotent while active');

select lives_ok($$ select public.withdraw_ai_consent() $$, 'withdraw_ai_consent runs');
select is(
  (select ai_consent_active from public.profiles
    where id = '27272727-2727-2727-2727-272727272701'),
  false, 'AI consent becomes inactive');
select is(
  (select count(*) from public.consent_log
    where user_id = '27272727-2727-2727-2727-272727272701'
      and action = 'withdrawn' and policy_doc_key = 'ai_routine_chat')::int,
  1, 'AI withdrawal has its own receipt');
select is(
  (select consent_active from public.profiles
    where id = '27272727-2727-2727-2727-272727272701'),
  true, 'AI withdrawal leaves scan consent active');

select lives_ok($$ select public.record_ai_consent() $$,
  'caller can restore AI consent explicitly');
select lives_ok($$ select public.withdraw_consent() $$,
  'withdrawing scan consent also completes');
select is(
  (select consent_active from public.profiles
    where id = '27272727-2727-2727-2727-272727272701'),
  false, 'scan consent becomes inactive');
select is(
  (select ai_consent_active from public.profiles
    where id = '27272727-2727-2727-2727-272727272701'),
  false, 'withdrawing scan consent also deactivates AI consent');
select is(
  (select count(*) from public.consent_log
    where user_id = '27272727-2727-2727-2727-272727272701'
      and action = 'withdrawn' and policy_doc_key = 'ai_routine_chat')::int,
  2, 'scan withdrawal writes the second AI withdrawal receipt');

select lives_ok($$ select public.record_consent() $$,
  'caller can restore scan consent');
select is(
  (select ai_consent_active from public.profiles
    where id = '27272727-2727-2727-2727-272727272701'),
  false, 'restoring scan consent does not silently restore AI consent');

select lives_ok($$ select public.record_ai_consent() $$,
  'caller can explicitly restore AI consent before data deletion');
select lives_ok($$ select public.delete_my_data() $$, 'delete_my_data runs');
select is(
  (select ai_consent_active from public.profiles
    where id = '27272727-2727-2727-2727-272727272701'),
  false, 'delete_my_data clears AI consent state');
reset role;
select is(
  (select count(*) from public.consent_log
    where user_id is null and action = 'deleted'
      and policy_doc_key = 'ai_routine_chat')::int,
  1, 'delete_my_data writes and de-identifies an AI deleted receipt');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"27272727-2727-2727-2727-272727272705","role":"authenticated"}';
select lives_ok($$ select public.delete_my_data() $$,
  'delete_my_data tolerates a missing profile so account deletion can continue');

select * from finish();
rollback;
