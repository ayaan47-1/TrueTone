begin;
select plan(3);

-- seed a current policy + two users' profiles as the privileged role
insert into public.policy_versions(version, doc_key, is_current) values ('v-test','biometric', true);
insert into auth.users(id) values ('11111111-1111-1111-1111-111111111111');
insert into auth.users(id) values ('22222222-2222-2222-2222-222222222222');
insert into public.profiles(id) values ('11111111-1111-1111-1111-111111111111');
insert into public.profiles(id) values ('22222222-2222-2222-2222-222222222222');

-- act as user 1
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*) from public.profiles where id = '22222222-2222-2222-2222-222222222222')::int,
  0, 'user1 cannot read user2 profile');
select is(
  (select count(*) from public.profiles where id = '11111111-1111-1111-1111-111111111111')::int,
  1, 'user1 can read own profile');
select is(
  (select count(*) from public.policy_versions)::int, 1, 'policy_versions world-readable');

select * from finish();
rollback;
