begin;
select plan(7);

-- profiles.id references auth.users, so every fixture profile needs its auth row first.
insert into auth.users(id) values
  ('a1a1a1a1-0000-0000-0000-000000000001'),
  ('a1a1a1a1-0000-0000-0000-000000000002'),
  ('a1a1a1a1-0000-0000-0000-000000000003');

select has_column('public', 'profiles', 'username', 'profiles has username');
select has_column('public', 'profiles', 'avatar_uri', 'profiles has avatar_uri');

select throws_ok(
  $$ insert into public.profiles(id, username) values (gen_random_uuid(), 'Not A Valid Handle') $$,
  '23514', null, 'username format constraint rejects an unnormalized value');

select lives_ok(
  $$ insert into public.profiles(id, username) values ('a1a1a1a1-0000-0000-0000-000000000001', 'ok_handle1') $$,
  'a normalized username insert succeeds');

-- Mixed case never reaches the index through the format check...
select throws_ok(
  $$ insert into public.profiles(id, username) values ('a1a1a1a1-0000-0000-0000-000000000002', 'OK_Handle1') $$,
  '23514', null, 'format constraint rejects a mixed-case handle before the index sees it');

-- ...so, to prove the lower(username) index is a real second line of defence, lift the
-- format check inside this rolled-back transaction and try the collision directly.
alter table public.profiles drop constraint profiles_username_format;
select throws_ok(
  $$ insert into public.profiles(id, username) values ('a1a1a1a1-0000-0000-0000-000000000003', 'OK_Handle1') $$,
  '23505', null, 'case-insensitive unique index rejects a same-handle-different-case collision');

select throws_ok(
  $$ insert into public.profiles(id, avatar_uri) values (gen_random_uuid(), repeat('x', 2049)) $$,
  '23514', null, 'avatar_uri length constraint rejects an oversized value');

select * from finish();
rollback;
