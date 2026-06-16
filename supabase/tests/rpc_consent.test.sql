begin;
select plan(4);
insert into auth.users(id) values ('44444444-4444-4444-4444-444444444444');
insert into public.profiles(id) values ('44444444-4444-4444-4444-444444444444');

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select lives_ok($$ select public.record_consent() $$, 'record_consent runs');
select is(
  (select consent_active from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
  true, 'consent_active set true');
select is(
  (select policy_version from public.consent_log where action='consented' limit 1),
  '2026-06-15.1', 'logged current biometric policy version');
-- idempotent: second call does not create a 2nd active-consent duplicate
select public.record_consent();
select is(
  (select count(*) from public.consent_log where action='consented')::int, 1, 'idempotent re-consent');
select * from finish();
rollback;
