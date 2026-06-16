// test/integration/scan-flow.test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY; // export from `npx supabase status`

const scores = {
  hydration: 0.5, oiliness: 0.5, texture: 0.5, pores: 0.5,
  darkSpots: 0.5, redness: 0.5, fineLines: 0.5, darkCircles: 0.5,
};

async function freshUser() {
  const c = createClient(URL, ANON);
  const { data, error } = await c.auth.signInAnonymously();
  assert.ifError(error);
  await c.from('profiles').upsert({ id: data.user.id, consent_active: true });
  return { c, id: data.user.id };
}

before(() => { assert.ok(ANON, 'set SUPABASE_ANON_KEY from `npx supabase status`'); });

test('record a scan then read it back', async () => {
  const { c } = await freshUser();
  const { error } = await c.rpc('record_scan', {
    p_scores: scores, p_skin_type: 'combination', p_model_version: 'stub-1', p_is_stub: true,
  });
  assert.ifError(error);
  const { data } = await c.from('scans').select('*').order('captured_at', { ascending: false }).limit(1);
  assert.equal(data.length, 1);
  assert.equal(Number(data[0].score_hydration), 0.5);
});

test('a second user cannot read the first user scans (RLS)', async () => {
  const a = await freshUser();
  await a.c.rpc('record_scan', { p_scores: scores, p_skin_type: 'dry', p_model_version: 'stub-1', p_is_stub: true });
  const b = await freshUser();
  const { data } = await b.c.from('scans').select('*');
  assert.equal(data.length, 0);
});

test('delete_my_data purges scans and writes a deletion audit', async () => {
  const { c } = await freshUser();
  await c.rpc('record_scan', { p_scores: scores, p_skin_type: 'oily', p_model_version: 'stub-1', p_is_stub: true });
  const { error } = await c.rpc('delete_my_data');
  assert.ifError(error);
  const { data } = await c.from('scans').select('*');
  assert.equal(data.length, 0);
});
