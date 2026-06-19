-- supabase/tests/scan_rpcs.test.sql
begin;
select plan(10);

insert into auth.users(id) values ('cccccccc-cccc-cccc-cccc-cccccccccccc');
insert into public.profiles(id, consent_active) values ('cccccccc-cccc-cccc-cccc-cccccccccccc', true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';

-- record_scan inserts one row with valid scores
select lives_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'stub-1', true, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1') $$, 'record_scan runs');
select is((select count(*) from public.scans where user_id='cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
  1, 'one scan recorded');

-- out-of-range score is rejected
select throws_ok($$
  select public.record_scan(
    '{"hydration":9,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'stub-1', true, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1') $$, 'P0001', NULL, 'out-of-range score rejected');

-- bad skin type is rejected
select throws_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'eczema-prone', 'stub-1', true, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1') $$, 'P0001', NULL, 'invalid skin type rejected');

-- a JSON null score is rejected with the RPC's P0001 contract (not a raw not-null DB error)
select throws_ok($$
  select public.record_scan(
    '{"hydration":null,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'stub-1', true, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1') $$, 'P0001', NULL, 'null score rejected with P0001');

-- clients cannot INSERT scans directly; writes go only through the SECURITY DEFINER RPC
select throws_ok($$
  insert into public.scans(user_id, score_hydration, score_oiliness, score_texture, score_pores,
    score_dark_spots, score_redness, score_fine_lines, score_dark_circles, skin_type_feel, model_version)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc',0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,'combination','stub-1') $$,
  '42501', NULL, 'clients cannot insert scans directly');

-- §15(a) purpose-met: withdrawing consent purges scans + writes an audit row
select public.withdraw_consent();
select is((select count(*) from public.scans where user_id='cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
  0, 'scans purged when consent withdrawn (purpose-met)');

-- deletion_audit is admin-only (RLS, no client policies); switch back to superuser to verify the row
reset role;
select is((select count(*) from public.deletion_audit
  where user_id='cccccccc-cccc-cccc-cccc-cccccccccccc' and table_name='scans')::int,
  1, 'deletion_audit row written for purged scans');

-- delete_my_data must purge scans and write EXACTLY ONE audit row (no double-audit from the
-- consent-withdrawn trigger that the consent flip would otherwise fire).
insert into auth.users(id) values ('dddddddd-dddd-dddd-dddd-dddddddddddd');
insert into public.profiles(id, consent_active) values ('dddddddd-dddd-dddd-dddd-dddddddddddd', true);
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
select public.record_scan(
  '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
  'combination', 'stub-1', true, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1');
select public.delete_my_data();
select is((select count(*) from public.scans where user_id='dddddddd-dddd-dddd-dddd-dddddddddddd')::int,
  0, 'delete_my_data purges scans');
reset role;
select is((select count(*) from public.deletion_audit
  where user_id='dddddddd-dddd-dddd-dddd-dddddddddddd' and table_name='scans')::int,
  1, 'delete_my_data writes exactly one scans audit row (no double-audit)');

select * from finish();
rollback;
