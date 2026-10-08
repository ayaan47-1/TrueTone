begin;
select plan(7);
insert into auth.users(id) values
  ('44444444-4444-4444-4444-444444444444'),
  ('44444444-4444-4444-4444-444444444445');
insert into public.profiles(id, consent_active) values
  ('44444444-4444-4444-4444-444444444444', false),
  ('44444444-4444-4444-4444-444444444445', true);
insert into public.consent_log(user_id, action, policy_version, policy_doc_key) values
  ('44444444-4444-4444-4444-444444444445', 'consented', '2026-06-15.1', 'biometric');

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select lives_ok($$ select public.record_consent() $$, 'record_consent runs');
select is(
  (select consent_active from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
  true, 'consent_active set true');
-- scope by user_id (not de-identified here) so committed rows from other runs don't interfere
select is(
  (select policy_version from public.consent_log
     where action='consented' and user_id='44444444-4444-4444-4444-444444444444' limit 1),
  '2026-10-06.a1', 'logged current biometric policy version');
-- idempotent: second call does not create a 2nd active-consent row for this user
select public.record_consent();
select is(
  (select count(*) from public.consent_log
     where action='consented' and user_id='44444444-4444-4444-4444-444444444444')::int,
  1, 'idempotent re-consent');

set local request.jwt.claims =
  '{"sub":"44444444-4444-4444-4444-444444444445","role":"authenticated"}';
select lives_ok($$ select public.record_consent() $$,
  'record_consent accepts the current policy after an old-version receipt');
select is(
  (select count(*) from public.consent_log
    where action='consented' and user_id='44444444-4444-4444-4444-444444444445'
      and policy_version='2026-10-06.a1')::int,
  1, 'version mismatch writes a new current biometric receipt');
select is(
  (select count(*) from public.consent_log
    where action='consented' and user_id='44444444-4444-4444-4444-444444444445')::int,
  2, 'the old receipt remains and the new receipt is appended');
select * from finish();
rollback;
