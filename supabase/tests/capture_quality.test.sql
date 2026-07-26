-- supabase/tests/capture_quality.test.sql
-- pgTAP coverage for migration 0013_capture_quality:
--   • scans.capture_quality column exists and is nullable
--   • 9-arg record_scan round-trips a valid band ('good'/'fair'/'poor')
--   • an out-of-vocabulary band is rejected by the RPC guard
--   • a NULL band still round-trips as NULL (existing callers keep working)
--   • CHECK constraint rejects an invalid value even via privileged insert
--   • delete_my_data() removes rows that carry a capture_quality value
--   • consent-withdrawn trigger purges rows that carry a capture_quality value
begin;
select plan(12);

-- ── user setup (UUID not used by any other suite) ─────────────────────────────
insert into auth.users(id) values ('cccccccc-cccc-cccc-cccc-cccccccccccc');
insert into public.profiles(id, consent_active)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', true);

-- ── 1. column exists and is nullable ───────────────────────────────────────────
select has_column('public', 'scans', 'capture_quality', 'scans.capture_quality exists');
select col_is_null('public', 'scans', 'capture_quality', 'capture_quality is nullable so old scans stay valid');

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';

-- ── 2. 9-arg record_scan with an omitted band runs and defaults to NULL ───────
select lives_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,
      "darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'dry', 'cv-1', false,
    '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1')
$$, '9-arg record_scan with omitted capture_quality runs (defaults apply)');

select is(
  (select capture_quality from public.scans
   where user_id='cccccccc-cccc-cccc-cccc-cccccccccccc' limit 1),
  NULL, 'capture_quality is null when not supplied');

-- ── 3. explicit NULL band round-trips as NULL, not a default ──────────────────
select lives_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,
      "darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'dry', 'cv-1', false,
    '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1',
    null, null, null)
$$, 'record_scan still accepts an explicit NULL band, so existing callers keep working');

select is(
  (select capture_quality from public.scans order by captured_at desc limit 1),
  null, 'a NULL band round-trips as NULL rather than a default');

-- ── 4. a valid band round-trips correctly ──────────────────────────────────────
select lives_ok($$
  select public.record_scan(
    '{"hydration":0.7,"oiliness":0.3,"texture":0.6,"pores":0.4,
      "darkSpots":0.2,"redness":0.1,"fineLines":0.5,"darkCircles":0.3}'::jsonb,
    'oily', 'cv-1', false,
    '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1',
    null, null, 'fair')
$$, '9-arg record_scan with a valid capture_quality band runs');

select is(
  (select capture_quality from public.scans
   where user_id='cccccccc-cccc-cccc-cccc-cccccccccccc'
     and capture_quality is not null
   limit 1),
  'fair', 'capture_quality persisted correctly');

-- ── 5. an out-of-vocabulary band is rejected by the RPC guard ─────────────────
select throws_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,
      "darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'dry', 'cv-1', false,
    '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1',
    null, null, 'excellent')
$$, 'P0001', NULL, 'record_scan rejects a band outside the allowed set');

-- ── 6. CHECK constraint catches a direct privileged write (defense in depth) ──
reset role;

select throws_ok($$
  insert into public.scans(user_id, score_hydration, score_oiliness, score_texture,
    score_pores, score_dark_spots, score_redness, score_fine_lines, score_dark_circles,
    skin_type_feel, model_version, capture_quality)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
    0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 'dry', 'cv-1', 'excellent')
$$, '23514', NULL, 'CHECK constraint rejects capture_quality=''excellent'' on direct insert');

-- ── 7. delete_my_data() removes rows that carry a capture_quality value ───────
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';

select public.delete_my_data();

reset role;
select is(
  (select count(*) from public.scans
   where user_id='cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
  0, 'delete_my_data() removes all scans including rows with a capture_quality value');

-- ── 8. consent-withdrawn trigger purges rows with a capture_quality value ─────
insert into auth.users(id) values ('dddddddd-1111-1111-1111-111111111111');
insert into public.profiles(id, consent_active)
  values ('dddddddd-1111-1111-1111-111111111111', true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-1111-1111-1111-111111111111","role":"authenticated"}';

select public.record_scan(
  '{"hydration":0.4,"oiliness":0.6,"texture":0.5,"pores":0.3,
    "darkSpots":0.7,"redness":0.2,"fineLines":0.4,"darkCircles":0.5}'::jsonb,
  'sensitive', 'cv-1', false,
  '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1',
  null, null, 'good');

select public.withdraw_consent();

reset role;
select is(
  (select count(*) from public.scans
   where user_id='dddddddd-1111-1111-1111-111111111111')::int,
  0, 'consent-withdrawn trigger purges scans carrying a capture_quality value');

select * from finish();
rollback;
