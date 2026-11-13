-- supabase/tests/profile_avatar_lock.test.sql
-- pgTAP coverage for 0042_profile_avatar_lock.sql (MASVS M1): profiles.avatar_uri is scrubbed,
-- clients cannot write it, it cannot hold a value, and delete_my_data clears it server-side.
-- NOT RUN when written (shared Supabase stack was in use); run with the next DB test pass.
begin;
select plan(14);

-- 1. The migration's scrub left no stored path behind.
select is((select count(*) from public.profiles where avatar_uri is not null), 0::bigint,
  'no profile row holds an avatar_uri after the migration');

-- 2-4. Client roles have no write privilege on the column; username stays writable.
select ok(not has_column_privilege('authenticated', 'public.profiles', 'avatar_uri', 'UPDATE')
          and not has_column_privilege('authenticated', 'public.profiles', 'avatar_uri', 'INSERT'),
  'authenticated cannot insert or update avatar_uri');
select ok(not has_column_privilege('anon', 'public.profiles', 'avatar_uri', 'UPDATE')
          and not has_column_privilege('anon', 'public.profiles', 'avatar_uri', 'INSERT'),
  'anon cannot insert or update avatar_uri');
select ok(has_column_privilege('authenticated', 'public.profiles', 'username', 'UPDATE'),
  'authenticated may still update username');

insert into auth.users(id) values
  ('42424242-4242-4242-4242-424242424201'), ('42424242-4242-4242-4242-424242424202');
insert into public.profiles(id, username) values
  ('42424242-4242-4242-4242-424242424201', 'avatar_lock_a'),
  ('42424242-4242-4242-4242-424242424202', 'avatar_lock_b');

-- 5. Even the owner (bypassing grants) cannot store a value: the column is constrained to null.
select throws_ok(
  $$ update public.profiles set avatar_uri = 'file:///var/mobile/avatar.jpg'
     where id = '42424242-4242-4242-4242-424242424201' $$,
  '23514', null, 'the check constraint rejects any avatar_uri value, even from the owner role');

set local role authenticated;
set local request.jwt.claims = '{"sub":"42424242-4242-4242-4242-424242424201","role":"authenticated"}';

-- 6-8. An authenticated client (old app build) cannot write the column; username-only saves work.
select throws_ok(
  $$ update public.profiles set avatar_uri = 'file:///var/mobile/avatar.jpg'
     where id = '42424242-4242-4242-4242-424242424201' $$,
  '42501', null, 'authenticated cannot write avatar_uri on its own row');
select throws_ok(
  $$ update public.profiles set username = 'avatar_lock_a2', avatar_uri = null
     where id = '42424242-4242-4242-4242-424242424201' $$,
  '42501', null, 'an old-client save that names avatar_uri is refused');
select lives_ok(
  $$ update public.profiles set username = 'avatar_lock_a2'
     where id = '42424242-4242-4242-4242-424242424201' $$,
  'a username-only save succeeds');

-- 9. delete_my_data runs as the user and leaves the column null (authoritative server-side clear).
select lives_ok($$ select public.delete_my_data() $$, 'delete_my_data runs for the signed-in user');
reset role;

-- 10. delete_my_data's body clears avatar_uri itself (not only via the constraint).
select ok(
  pg_get_functiondef('public.delete_my_data()'::regprocedure) ~* 'avatar_uri\s*=\s*null'
  and (select avatar_uri is null from public.profiles where id = '42424242-4242-4242-4242-424242424201'),
  'delete_my_data sets avatar_uri = null server-side and the row is clear');

-- 11-14. Upgraded accounts (Toby round 2): seed the legacy file:// paths older builds wrote, then
-- prove the migration's scrub clears them. The constraint is dropped only inside this rolled-back
-- transaction so the legacy state can exist.
alter table public.profiles drop constraint profiles_avatar_uri_unused;
update public.profiles set avatar_uri = 'file:///var/mobile/Containers/Data/Application/X/Library/Caches/ImagePicker/a.jpg'
 where id = '42424242-4242-4242-4242-424242424201';
update public.profiles set avatar_uri = 'file:///var/mobile/Containers/Data/Application/Y/Library/Caches/ImagePicker/b.jpg'
 where id = '42424242-4242-4242-4242-424242424202';
select ok(not has_function_privilege('authenticated', 'public.scrub_profile_avatar_uris()', 'EXECUTE')
          and not has_function_privilege('anon', 'public.scrub_profile_avatar_uris()', 'EXECUTE'),
  'clients cannot execute the scrub');
select is(public.scrub_profile_avatar_uris(), 2, 'the scrub clears both legacy device paths');
select is((select count(*) from public.profiles where avatar_uri is not null), 0::bigint,
  'no upgraded account keeps a device path on the server');
select is((select username from public.profiles where id = '42424242-4242-4242-4242-424242424202'),
  'avatar_lock_b', 'the scrub leaves other profile fields alone');

select * from finish();
rollback;
