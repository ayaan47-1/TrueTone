-- supabase/tests/routine_feedback.test.sql
begin;
select plan(10);

-- ── primary user (user1) ──────────────────────────────────────────────────────
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

-- ── cross-user isolation: user1 CANNOT write feedback to user2's real scan ───
-- Create user2 as a privileged role and record a scan for them so we have a
-- real scan UUID that belongs to user2 (not just a nil/unknown UUID).
reset role;
insert into auth.users(id) values ('88888888-8888-8888-8888-888888888888');
insert into public.profiles(id, consent_active) values ('88888888-8888-8888-8888-888888888888', true);

-- Create the temp table as superuser and grant access to the authenticated role
-- so we can pass user2's scan id across the role boundary.
create temp table _u2_scan(scan_id uuid) on commit drop;
grant insert, select on _u2_scan to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}';

insert into _u2_scan(scan_id)
select (public.record_scan(
  '{"hydration":0.6,"oiliness":0.4,"texture":0.5,"pores":0.5,
    "darkSpots":0.3,"redness":0.2,"fineLines":0.4,"darkCircles":0.5}'::jsonb,
  'oily', 'stub-1', true,
  '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1')).id;

-- Switch to user1 and attempt to set feedback on user2's scan by its real UUID.
-- The RPC's `where id = p_scan_id and user_id = auth.uid()` predicate must block this.
set local request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';

select throws_ok($$
  select public.set_routine_feedback((select scan_id from _u2_scan), 'helped')
$$, 'P0001', 'scan not found',
  'user1 cannot write feedback to user2''s real scan id (cross-user isolation)');

-- Verify user2's row is untouched (routine_helpful remains null)
reset role;
select is(
  (select routine_helpful from public.scans
   where id = (select scan_id from _u2_scan)),
  NULL,
  'user2 scan routine_helpful unchanged after cross-user attempt');

select * from finish();
rollback;
