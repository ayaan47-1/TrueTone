-- supabase/tests/routine_rpcs.test.sql
begin;
select plan(6);

insert into auth.users(id) values ('dddddddd-dddd-dddd-dddd-dddddddddddd');
insert into public.profiles(id, consent_active) values ('dddddddd-dddd-dddd-dddd-dddddddddddd', true);
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';

-- routine column exists
select has_column('public', 'scans', 'routine', 'scans.routine exists');
select has_column('public', 'scans', 'routine_engine_version', 'scans.routine_engine_version exists');

-- record_scan persists the routine atomically with scores
select lives_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'stub-1', true,
    '{"version":"skincare-1","am":[],"pm":[],"notes":[]}'::jsonb, 'skincare-1') $$,
  'record_scan with routine runs');

select is((select routine_engine_version from public.scans
           where user_id='dddddddd-dddd-dddd-dddd-dddddddddddd' limit 1),
  'skincare-1', 'routine version persisted');

-- a routine missing the required "version" key is rejected with the P0001 contract
select throws_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'stub-1', true, '{"am":[],"pm":[]}'::jsonb, 'skincare-1') $$,
  'P0001', NULL, 'malformed routine rejected');

-- withdrawing consent purges the scan (routine rides the row)
select public.withdraw_consent();
select is((select count(*) from public.scans where user_id='dddddddd-dddd-dddd-dddd-dddddddddddd')::int,
  0, 'routine purged with scan on consent withdrawal');

select * from finish();
rollback;
