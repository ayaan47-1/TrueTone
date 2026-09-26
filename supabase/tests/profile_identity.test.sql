begin;
select plan(6);

select has_column('public', 'profiles', 'username', 'profiles has username');
select has_column('public', 'profiles', 'avatar_uri', 'profiles has avatar_uri');

select throws_ok(
  $$ insert into public.profiles(id, username) values (gen_random_uuid(), 'Not A Valid Handle') $$,
  '23514', null, 'username format constraint rejects an unnormalized value');

select lives_ok(
  $$ insert into public.profiles(id, username) values (gen_random_uuid(), 'ok_handle1') $$,
  'a normalized username insert succeeds');

select throws_ok(
  $$ insert into public.profiles(id, username) values (gen_random_uuid(), 'OK_Handle1') $$,
  '23505', null, 'case-insensitive unique index rejects a same-handle-different-case collision');

select throws_ok(
  $$ insert into public.profiles(id, avatar_uri) values (gen_random_uuid(), repeat('x', 2049)) $$,
  '23514', null, 'avatar_uri length constraint rejects an oversized value');

select * from finish();
rollback;
