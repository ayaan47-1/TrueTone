-- pgTAP coverage for 0026_profile_flags_lock.sql.
-- Client roles may edit presentation-only profile fields, while age and biometric-consent
-- state can change only through self-scoped SECURITY DEFINER RPCs.
begin;
select plan(35);

-- Table-level writes are gone for both client roles. Authenticated users retain column-level
-- writes only for presentation data; compliance-owned fields remain server-only.
select ok(not has_table_privilege('authenticated', 'public.profiles', 'INSERT'),
  'authenticated has no table INSERT on profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'UPDATE'),
  'authenticated has no table UPDATE on profiles');
select ok(not has_table_privilege('anon', 'public.profiles', 'INSERT'),
  'anon has no table INSERT on profiles');
select ok(not has_table_privilege('anon', 'public.profiles', 'UPDATE'),
  'anon has no table UPDATE on profiles');
select ok(has_column_privilege('authenticated', 'public.profiles', 'username', 'UPDATE'),
  'authenticated may update username');
select ok(has_column_privilege('authenticated', 'public.profiles', 'avatar_uri', 'UPDATE'),
  'authenticated may update avatar_uri');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'consent_active', 'UPDATE'),
  'authenticated cannot update consent_active');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'is_18_plus', 'UPDATE'),
  'authenticated cannot update is_18_plus');

insert into auth.users(id) values
  ('26262626-2626-2626-2626-262626262601'),
  ('26262626-2626-2626-2626-262626262602'),
  ('26262626-2626-2626-2626-262626262603');
insert into public.profiles(id, username) values
  ('26262626-2626-2626-2626-262626262601', 'flags_user_a'),
  ('26262626-2626-2626-2626-262626262602', 'flags_user_b');

set local role anon;
select throws_ok($$ select public.ensure_profile() $$, '42501', null,
  'anon cannot execute profile bootstrap');
select throws_ok($$ select public.verify_age_18_plus() $$, '42501', null,
  'anon cannot execute age verification');
reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"26262626-2626-2626-2626-262626262601","role":"authenticated"}';

select throws_ok(
  $$ update public.profiles set consent_active = true where id = '26262626-2626-2626-2626-262626262601' $$,
  '42501', null, 'authenticated cannot patch consent_active');
select throws_ok(
  $$ update public.profiles set is_18_plus = true where id = '26262626-2626-2626-2626-262626262601' $$,
  '42501', null, 'authenticated cannot patch is_18_plus');
select throws_ok(
  $$ insert into public.profiles(id) values ('26262626-2626-2626-2626-262626262603') $$,
  '42501', null, 'authenticated cannot insert a profile directly');
select throws_ok(
  $$ insert into public.consent_log(user_id, action, policy_version)
       values ('26262626-2626-2626-2626-262626262601', 'consented', '2026-06-15.1') $$,
  '42501', null, 'authenticated cannot forge a consent receipt');

select lives_ok(
  $$ update public.profiles set username = 'flags_user_a2', avatar_uri = 'file:///avatar-a.jpg'
     where id = '26262626-2626-2626-2626-262626262601' $$,
  'authenticated may update its username and avatar');
select is(
  (select username from public.profiles where id = '26262626-2626-2626-2626-262626262601'),
  'flags_user_a2', 'username update persisted');
select is(
  (select avatar_uri from public.profiles where id = '26262626-2626-2626-2626-262626262601'),
  'file:///avatar-a.jpg', 'avatar update persisted');
select lives_ok(
  $$ update public.profiles set username = 'stolen_name'
     where id = '26262626-2626-2626-2626-262626262602' $$,
  'row-level security hides another profile from an allowed-column update');
reset role;
select is(
  (select username from public.profiles where id = '26262626-2626-2626-2626-262626262602'),
  'flags_user_b', 'another profile was not changed');
set local role authenticated;

select lives_ok($$ select public.verify_age_18_plus() $$, 'age-verification RPC runs');
select is(
  (select is_18_plus from public.profiles where id = '26262626-2626-2626-2626-262626262601'),
  true, 'age-verification RPC updates the caller');
select isnt(
  (select age_verified_at from public.profiles where id = '26262626-2626-2626-2626-262626262601'),
  null::timestamptz, 'age-verification RPC records its timestamp');
reset role;
select is(
  (select is_18_plus from public.profiles where id = '26262626-2626-2626-2626-262626262602'),
  false, 'age-verification RPC does not update another user');
set local role authenticated;

select lives_ok($$ select public.record_consent() $$, 'record_consent runs for the caller');
select is(
  (select consent_active from public.profiles where id = '26262626-2626-2626-2626-262626262601'),
  true, 'record_consent activates consent for the caller');
reset role;
select is(
  (select consent_active from public.profiles where id = '26262626-2626-2626-2626-262626262602'),
  false, 'record_consent does not activate another user');
set local role authenticated;
select lives_ok($$ select public.withdraw_consent() $$, 'withdraw_consent runs for the caller');
select is(
  (select consent_active from public.profiles where id = '26262626-2626-2626-2626-262626262601'),
  false, 'withdraw_consent deactivates consent for the caller');

select throws_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'stub-1', true, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1')
$$, 'P0001', null, 'record_scan rejects a caller without active consent');
select lives_ok($$ select public.record_consent() $$, 'caller can restore consent through the consent RPC');
select lives_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'stub-1', true, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1')
$$, 'record_scan accepts a caller with both gates');

set local request.jwt.claims =
  '{"sub":"26262626-2626-2626-2626-262626262602","role":"authenticated"}';
select lives_ok($$ select public.record_consent() $$, 'second caller can record its own consent');
select throws_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'stub-1', true, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1')
$$, 'P0001', null, 'record_scan rejects a caller without age verification');

set local request.jwt.claims =
  '{"sub":"26262626-2626-2626-2626-262626262603","role":"authenticated"}';
select lives_ok($$ select public.ensure_profile() $$, 'profile bootstrap RPC runs for its caller');
select is(
  (select id from public.profiles where id = '26262626-2626-2626-2626-262626262603'),
  '26262626-2626-2626-2626-262626262603'::uuid, 'profile bootstrap creates only the caller profile');

select * from finish();
rollback;
