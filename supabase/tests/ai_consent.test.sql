begin;
select plan(9);

insert into auth.users(id) values ('27272727-2727-2727-2727-272727272727');
insert into public.profiles(id, is_18_plus, consent_active)
  values ('27272727-2727-2727-2727-272727272727', true, true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"27272727-2727-2727-2727-272727272727","role":"authenticated"}';

select lives_ok($$ select public.record_ai_consent() $$, 'record_ai_consent runs');
select is(
  (select ai_consent_active from public.profiles where id = '27272727-2727-2727-2727-272727272727'),
  true, 'AI consent becomes active');
select is(
  (select count(*) from public.consent_log
    where user_id = '27272727-2727-2727-2727-272727272727'
      and action = 'consented' and policy_doc_key = 'ai_routine_chat')::int,
  1, 'AI consent has its own receipt');

select public.record_ai_consent();
select is(
  (select count(*) from public.consent_log
    where user_id = '27272727-2727-2727-2727-272727272727'
      and action = 'consented' and policy_doc_key = 'ai_routine_chat')::int,
  1, 'AI re-consent is idempotent while active');

select lives_ok($$ select public.withdraw_ai_consent() $$, 'withdraw_ai_consent runs');
select is(
  (select ai_consent_active from public.profiles where id = '27272727-2727-2727-2727-272727272727'),
  false, 'AI consent becomes inactive');
select is(
  (select count(*) from public.consent_log
    where user_id = '27272727-2727-2727-2727-272727272727'
      and action = 'withdrawn' and policy_doc_key = 'ai_routine_chat')::int,
  1, 'AI withdrawal has its own receipt');
select is(
  (select consent_active from public.profiles where id = '27272727-2727-2727-2727-272727272727'),
  true, 'AI withdrawal leaves scan consent active');

select public.record_ai_consent();
select public.delete_my_data();
select is(
  (select ai_consent_active from public.profiles where id = '27272727-2727-2727-2727-272727272727'),
  false, 'delete_my_data clears AI consent state');

select * from finish();
rollback;
