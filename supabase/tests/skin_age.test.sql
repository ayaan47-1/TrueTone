-- supabase/tests/skin_age.test.sql
-- pgTAP coverage for migration 0011_skin_age:
--   • skin_age_estimate / skin_age_confidence columns exist and persist
--   • 8-arg record_scan round-trips non-null skin-age values
--   • out-of-range age / confidence rejected by the RPC guard
--   • CHECK constraints reject invalid values even via privileged insert
--   • delete_my_data() removes rows that carry skin-age data
--   • consent-withdrawn trigger purges rows that carry skin-age data
begin;
select plan(15);

-- ── user setup (UUIDs not used by any other suite) ───────────────────────────
insert into auth.users(id) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
insert into public.profiles(id, consent_active)
  values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);

-- ── 1. columns exist ─────────────────────────────────────────────────────────
select has_column('public', 'scans', 'skin_age_estimate',
  'scans.skin_age_estimate column exists');
select has_column('public', 'scans', 'skin_age_confidence',
  'scans.skin_age_confidence column exists');

-- ── 2. columns are nullable (no scan requires skin-age) ───────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}';

select lives_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,
      "darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'dry', 'cv-1', false,
    '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1')
$$, '8-arg record_scan with null skin_age runs (omitted defaults)');

select is(
  (select skin_age_estimate from public.scans
   where user_id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' limit 1),
  NULL, 'skin_age_estimate is null when not supplied');
select is(
  (select skin_age_confidence from public.scans
   where user_id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' limit 1),
  NULL, 'skin_age_confidence is null when not supplied');

-- ── 3. non-null skin-age round-trips correctly ────────────────────────────────
select lives_ok($$
  select public.record_scan(
    '{"hydration":0.7,"oiliness":0.3,"texture":0.6,"pores":0.4,
      "darkSpots":0.2,"redness":0.1,"fineLines":0.5,"darkCircles":0.3}'::jsonb,
    'oily', 'cv-1', false,
    '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1',
    35, 0.82)
$$, '8-arg record_scan with non-null skin_age runs');

-- Grab the row that has age data (skin_age_estimate is not null)
select is(
  (select skin_age_estimate from public.scans
   where user_id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
     and skin_age_estimate is not null
   limit 1),
  35, 'skin_age_estimate persisted correctly');

select is(
  (select skin_age_confidence from public.scans
   where user_id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
     and skin_age_confidence is not null
   limit 1)::numeric,
  0.82::numeric, 'skin_age_confidence persisted correctly');

-- ── 4. out-of-range age rejected by the RPC guard ────────────────────────────
select throws_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,
      "darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'cv-1', false,
    '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1',
    200, null)
$$, 'P0001', NULL, 'skin_age=200 rejected with P0001 by RPC guard');

select throws_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,
      "darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'cv-1', false,
    '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1',
    -1, null)
$$, 'P0001', NULL, 'skin_age=-1 rejected with P0001 by RPC guard');

-- ── 5. out-of-range confidence rejected by the RPC guard ─────────────────────
select throws_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,
      "darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'cv-1', false,
    '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1',
    30, 2.0)
$$, 'P0001', NULL, 'skin_age_confidence=2.0 rejected with P0001 by RPC guard');

-- ── 6. CHECK constraints catch direct privileged writes (defense in depth) ───
-- Switch back to the privileged role so we can attempt a bare INSERT.
reset role;

select throws_ok($$
  insert into public.scans(user_id, score_hydration, score_oiliness, score_texture,
    score_pores, score_dark_spots, score_redness, score_fine_lines, score_dark_circles,
    skin_type_feel, model_version, skin_age_estimate)
  values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 'dry', 'cv-1', 150)
$$, '23514', NULL, 'CHECK constraint rejects skin_age_estimate=150 on direct insert');

select throws_ok($$
  insert into public.scans(user_id, score_hydration, score_oiliness, score_texture,
    score_pores, score_dark_spots, score_redness, score_fine_lines, score_dark_circles,
    skin_type_feel, model_version, skin_age_confidence)
  values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 'dry', 'cv-1', 1.5)
$$, '23514', NULL, 'CHECK constraint rejects skin_age_confidence=1.5 on direct insert');

-- ── 7. delete_my_data() removes rows that carry skin-age data ─────────────────
-- We already have 2 rows for eeeeeeee (one with age, one without).
-- Call delete_my_data() as that user and confirm both are gone.
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}';

select public.delete_my_data();

reset role;
select is(
  (select count(*) from public.scans
   where user_id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')::int,
  0, 'delete_my_data() removes all scans including rows with skin_age data');

-- ── 8. consent-withdrawn trigger purges rows with skin-age data ───────────────
-- Set up a fresh user, give them a scan with skin-age, then withdraw consent.
insert into auth.users(id) values ('ffffffff-ffff-ffff-ffff-ffffffffffff');
insert into public.profiles(id, consent_active)
  values ('ffffffff-ffff-ffff-ffff-ffffffffffff', true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"ffffffff-ffff-ffff-ffff-ffffffffffff","role":"authenticated"}';

select public.record_scan(
  '{"hydration":0.4,"oiliness":0.6,"texture":0.5,"pores":0.3,
    "darkSpots":0.7,"redness":0.2,"fineLines":0.4,"darkCircles":0.5}'::jsonb,
  'sensitive', 'cv-1', false,
  '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1',
  28, 0.91);

select public.withdraw_consent();

reset role;
select is(
  (select count(*) from public.scans
   where user_id='ffffffff-ffff-ffff-ffff-ffffffffffff')::int,
  0, 'consent-withdrawn trigger purges scans carrying skin_age data');

select * from finish();
rollback;
