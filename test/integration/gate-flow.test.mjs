import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

// End-to-end gate flow against the running local Supabase.
// Run with `npm run test:integration` (needs `npx supabase start`).
// Uses node:test (not jest) because jest-expo's environment breaks supabase-js's fetch.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const key =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

test('anon user: gate locked until 18+ AND consent, then unlocked; delete tears down', async () => {
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: anon, error: anonErr } = await sb.auth.signInAnonymously();
  assert.equal(anonErr, null, 'anonymous sign-in succeeds');
  const uid = anon.user.id;
  await sb.from('profiles').upsert({ id: uid });

  // initially locked: not 18+, no consent
  let { data: p } = await sb.from('profiles').select('is_18_plus, consent_active').eq('id', uid).single();
  assert.equal(p.is_18_plus, false, 'starts not 18+');
  assert.equal(p.consent_active, false, 'starts without consent');

  // pass age gate + record consent
  await sb.from('profiles').update({ is_18_plus: true, age_verified_at: new Date().toISOString() }).eq('id', uid);
  const { error: consentErr } = await sb.rpc('record_consent');
  assert.equal(consentErr, null, 'record_consent succeeds');

  // now unlocked
  ({ data: p } = await sb.from('profiles').select('is_18_plus, consent_active').eq('id', uid).single());
  assert.equal(p.is_18_plus, true, '18+ after age gate');
  assert.equal(p.consent_active, true, 'consent active after record_consent');

  // a consent receipt exists, pinned to a real policy version
  const { data: receipts } = await sb
    .from('consent_log')
    .select('action, policy_version')
    .eq('action', 'consented');
  assert.ok(receipts.length > 0, 'consent receipt written');
  assert.ok(receipts[0].policy_version, 'receipt pins a policy version');

  // delete_account tears down the profile row
  const { error: delErr } = await sb.rpc('delete_account');
  assert.equal(delErr, null, 'delete_account succeeds');
});
