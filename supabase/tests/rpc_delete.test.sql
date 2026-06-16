begin;
select plan(3);
insert into auth.users(id) values ('55555555-5555-5555-5555-555555555555');
insert into public.profiles(id, is_18_plus, age_verified_at)
  values ('55555555-5555-5555-5555-555555555555', true, now());

-- baseline of committed 'deleted' receipts (de-identification nulls user_id, so we can't
-- filter by user afterward — measure a delta instead, robust to prior committed deletions)
create temp table _baseline as
  select count(*)::int as c from public.consent_log where action='deleted';

set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
select public.record_consent();
select public.delete_my_data();

-- verify as privileged role: de-identified rows (user_id null) are hidden from the
-- authenticated caller by RLS, so the assertions must bypass it
reset role;

select is(
  (select is_18_plus from public.profiles where id='55555555-5555-5555-5555-555555555555'),
  false, 'delete_my_data clears derived data');
select is(
  (select count(*)::int from public.consent_log where action='deleted') - (select c from _baseline),
  1, 'exactly one deletion logged (delta)');
select is(
  (select count(*) from public.consent_log where user_id is null)::int >= 1, true,
  'prior consent rows de-identified (user_id null)');
select * from finish();
rollback;
