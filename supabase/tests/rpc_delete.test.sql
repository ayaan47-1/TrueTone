begin;
select plan(3);
insert into auth.users(id) values ('55555555-5555-5555-5555-555555555555');
insert into public.profiles(id, is_18_plus, age_verified_at)
  values ('55555555-5555-5555-5555-555555555555', true, now());

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
  (select count(*) from public.consent_log where action='deleted')::int, 1, 'deletion logged');
select is(
  (select count(*) from public.consent_log where user_id is null)::int >= 1, true,
  'prior consent rows de-identified (user_id null)');
select * from finish();
rollback;
