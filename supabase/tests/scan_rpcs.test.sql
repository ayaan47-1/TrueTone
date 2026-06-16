-- supabase/tests/scan_rpcs.test.sql
begin;
select plan(6);

insert into auth.users(id) values ('cccccccc-cccc-cccc-cccc-cccccccccccc');
insert into public.profiles(id, consent_active) values ('cccccccc-cccc-cccc-cccc-cccccccccccc', true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';

-- record_scan inserts one row with valid scores
select lives_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'stub-1', true) $$, 'record_scan runs');
select is((select count(*) from public.scans where user_id='cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
  1, 'one scan recorded');

-- out-of-range score is rejected
select throws_ok($$
  select public.record_scan(
    '{"hydration":9,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'stub-1', true) $$, 'P0001', NULL, 'out-of-range score rejected');

-- bad skin type is rejected
select throws_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'eczema-prone', 'stub-1', true) $$, 'P0001', NULL, 'invalid skin type rejected');

-- §15(a) purpose-met: withdrawing consent purges scans + writes an audit row
select public.withdraw_consent();
select is((select count(*) from public.scans where user_id='cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
  0, 'scans purged when consent withdrawn (purpose-met)');

-- deletion_audit is admin-only (RLS, no client policies); switch back to superuser to verify the row
reset role;
select is((select count(*) from public.deletion_audit
  where user_id='cccccccc-cccc-cccc-cccc-cccccccccccc' and table_name='scans')::int,
  1, 'deletion_audit row written for purged scans');

select * from finish();
rollback;
