-- supabase/tests/routine_feedback.test.sql
begin;
select plan(8);

insert into auth.users(id) values ('dddddddd-dddd-dddd-dddd-dddddddddddd');
insert into public.profiles(id, consent_active) values ('dddddddd-dddd-dddd-dddd-dddddddddddd', true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';

-- seed a scan to attach feedback to
select public.record_scan(
  '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
  'combination', 'stub-1', true, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1');

-- the new columns exist and default to null
select is((select routine_helpful from public.scans
  where user_id='dddddddd-dddd-dddd-dddd-dddddddddddd' limit 1), NULL, 'routine_helpful defaults null');

-- set_routine_feedback writes an approved value to the caller's own row
select lives_ok($$
  select public.set_routine_feedback(
    (select id from public.scans where user_id='dddddddd-dddd-dddd-dddd-dddddddddddd' limit 1), 'helped') $$,
  'set_routine_feedback runs');
select is((select routine_helpful from public.scans
  where user_id='dddddddd-dddd-dddd-dddd-dddddddddddd' limit 1), 'helped', 'feedback persisted');
select isnt((select feedback_at from public.scans
  where user_id='dddddddd-dddd-dddd-dddd-dddddddddddd' limit 1), NULL, 'feedback_at is stamped');

-- an out-of-vocabulary value is rejected with the P0001 contract
select throws_ok($$
  select public.set_routine_feedback(
    (select id from public.scans where user_id='dddddddd-dddd-dddd-dddd-dddddddddddd' limit 1), 'cured') $$,
  'P0001', NULL, 'invalid feedback value rejected');

-- a null value is rejected too (`null not in (...)` is null/falsy, so the bare guard would miss it)
select throws_ok($$
  select public.set_routine_feedback(
    (select id from public.scans where user_id='dddddddd-dddd-dddd-dddd-dddddddddddd' limit 1), NULL) $$,
  'P0001', NULL, 'null feedback value rejected');

-- feedback to a non-existent / other-user scan id is rejected (cannot touch another row)
select throws_ok($$
  select public.set_routine_feedback('00000000-0000-0000-0000-000000000000', 'helped') $$,
  'P0001', NULL, 'unknown scan id rejected');

-- clients cannot UPDATE scans directly (SELECT-only RLS); the column moves only via the RPC
select throws_ok($$
  update public.scans set routine_helpful='helped'
   where user_id='dddddddd-dddd-dddd-dddd-dddddddddddd' $$,
  '42501', NULL, 'direct client UPDATE on scans is blocked by RLS');

select * from finish();
rollback;
