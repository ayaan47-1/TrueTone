-- supabase/tests/shade_history.test.sql
-- pgTAP coverage for migration 0032_shade_history (Dwight ruling, shade-history-ruling.md):
--   • shade label columns exist on scans, nullable; NO raw lightness/warmth/olive columns
--   • record_scan round-trips shade words + capture mode; omitted shade stays NULL
--   • RPC rejects out-of-vocabulary labels and any raw numeric keys (data minimization)
--   • CHECK constraints hold on a privileged insert (defense in depth)
--   • clear_shade_history() nulls only the caller's shade columns, keeps the scan rows
--   • RLS select-own: another user's shade labels are not readable
--   • delete_my_data() / consent withdrawal still purge rows carrying shade labels
begin;
select plan(26);

insert into auth.users(id) values
  ('5ade0000-0000-0000-0000-000000000001'), ('5ade0000-0000-0000-0000-000000000002');
insert into public.profiles(id, consent_active, is_18_plus) values
  ('5ade0000-0000-0000-0000-000000000001', true, true),
  ('5ade0000-0000-0000-0000-000000000002', true, true);

-- ── 1. schema ─────────────────────────────────────────────────────────────────
select has_column('public', 'scans', 'shade_depth_band', 'scans.shade_depth_band exists');
select has_column('public', 'scans', 'shade_undertone', 'scans.shade_undertone exists');
select has_column('public', 'scans', 'shade_finish', 'scans.shade_finish exists');
select has_column('public', 'scans', 'shade_name', 'scans.shade_name exists');
select has_column('public', 'scans', 'capture_mode', 'scans.capture_mode exists');
select col_is_null('public', 'scans', 'shade_name', 'shade_name is nullable so old scans stay valid');
select is(
  (select count(*)::int from information_schema.columns
    where table_schema='public' and table_name='scans'
      and column_name ~ '(lightness|warmth|olive)'),
  0, 'no raw tone-number columns are stored (data minimization)');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'record_scan'),
  1, 'record_scan has exactly one signature');
select is(
  (select p.pronargs::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'record_scan'),
  11, 'the sole record_scan signature has eleven arguments');
select ok(
  not has_function_privilege('anon',
    'public.record_scan(jsonb,text,text,boolean,jsonb,text,integer,numeric,text,jsonb,text)',
    'EXECUTE')
  and has_function_privilege('authenticated',
    'public.record_scan(jsonb,text,text,boolean,jsonb,text,integer,numeric,text,jsonb,text)',
    'EXECUTE'),
  'only authenticated can execute record_scan');

-- ── 2. record_scan round-trip ────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"5ade0000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,
      "darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'dry', 'cv-1', false, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1')
$$, 'record_scan without a shade still runs (existing callers keep working)');
select is((select shade_name from public.scans order by captured_at desc limit 1), null,
  'omitted shade persists as NULL');

select lives_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,
      "darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'dry', 'cv-1', false, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1',
    null, null, 'good',
    '{"depthBand":"tan","undertone":"warm","finish":"satin","shadeName":"Tan Warm"}'::jsonb,
    'pair')
$$, 'record_scan with a shade + capture mode runs');
select results_eq(
  $$ select shade_depth_band, shade_undertone, shade_finish, shade_name, capture_mode
       from public.scans where shade_name is not null $$,
  $$ values ('tan'::text, 'warm'::text, 'satin'::text, 'Tan Warm'::text, 'pair'::text) $$,
  'shade words + capture mode persisted');

-- ── 3. RPC guards ────────────────────────────────────────────────────────────
select throws_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,
      "darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'dry', 'cv-1', false, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1',
    null, null, null,
    '{"depthBand":"tan","undertone":"warm","finish":"satin","shadeName":"Tan Warm","lightness":0.4}'::jsonb,
    'single')
$$, 'P0001', NULL, 'record_scan rejects raw tone numbers inside the shade payload');
select throws_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,
      "darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'dry', 'cv-1', false, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1',
    null, null, null,
    '{"depthBand":"7","undertone":"warm","finish":"satin","shadeName":"Tan Warm"}'::jsonb, null)
$$, 'P0001', NULL, 'record_scan rejects a numeric depth instead of a band word');
select throws_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,
      "darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'dry', 'cv-1', false, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1',
    null, null, null,
    '{"depthBand":"tan","undertone":"warm","finish":"satin"}'::jsonb, null)
$$, 'P0001', NULL, 'record_scan rejects a partial shade');
select throws_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,
      "darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'dry', 'cv-1', false, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1',
    null, null, null, null, 'triple')
$$, 'P0001', NULL, 'record_scan rejects an unknown capture mode');

-- ── 4. CHECK constraints (privileged write) ──────────────────────────────────
reset role;
select throws_ok($$
  insert into public.scans(user_id, score_hydration, score_oiliness, score_texture,
    score_pores, score_dark_spots, score_redness, score_fine_lines, score_dark_circles,
    skin_type_feel, model_version, shade_depth_band, shade_undertone, shade_finish, shade_name)
  values ('5ade0000-0000-0000-0000-000000000001', 0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,
    'dry','cv-1','bronze','warm','satin','Bronze Warm')
$$, '23514', NULL, 'CHECK rejects an out-of-vocabulary depth band');
select throws_ok($$
  insert into public.scans(user_id, score_hydration, score_oiliness, score_texture,
    score_pores, score_dark_spots, score_redness, score_fine_lines, score_dark_circles,
    skin_type_feel, model_version, shade_name)
  values ('5ade0000-0000-0000-0000-000000000001', 0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,
    'dry','cv-1','Tan Warm')
$$, '23514', NULL, 'CHECK rejects a partial shade (all four labels or none)');

-- ── 5. clear_shade_history: own rows only, scan rows kept ────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"5ade0000-0000-0000-0000-000000000002","role":"authenticated"}';
select public.record_scan(
  '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,
    "darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
  'oily', 'cv-1', false, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1',
  null, null, null,
  '{"depthBand":"light","undertone":"cool","finish":"matte","shadeName":"Light Cool"}'::jsonb,
  'single');

set local request.jwt.claims = '{"sub":"5ade0000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.clear_shade_history() $$, 'clear_shade_history runs for the caller');

reset role;
select is(
  (select count(*)::int from public.scans
    where user_id='5ade0000-0000-0000-0000-000000000001'
      and (shade_name is not null or shade_depth_band is not null or capture_mode is not null)),
  0, 'caller''s shade labels + capture mode are cleared');
select is(
  (select count(*)::int from public.scans where user_id='5ade0000-0000-0000-0000-000000000001'),
  2, 'caller''s scan rows (skincare scores) are kept — this is not account/data delete');
select is(
  (select shade_name from public.scans where user_id='5ade0000-0000-0000-0000-000000000002'),
  'Light Cool', 'another user''s shade history is untouched (RLS-safe)');

set local role authenticated;
set local request.jwt.claims = '{"sub":"5ade0000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from public.scans where shade_name is not null),
  0, 'RLS select-own: a user cannot read another user''s shade history');
reset role;

-- ── 6. existing purge paths still cover rows with shade labels ───────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"5ade0000-0000-0000-0000-000000000002","role":"authenticated"}';
select public.delete_my_data();
reset role;
select is(
  (select count(*)::int from public.scans where user_id='5ade0000-0000-0000-0000-000000000002'),
  0, 'delete_my_data() removes scans carrying shade labels');

select * from finish();
rollback;
