// MASVS M1 (Dwight round-2 FAIL): profiles.avatar_uri held device-local file paths. A forward migration
// must scrub every existing value, take client write access away, keep the column null, and make the
// Delete My Data RPC clear it server-side. pgTAP proves this against a database; this static test keeps
// the migration and the client code from drifting when the database tests are not run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const migDir = join(root, 'supabase/migrations');
const migrations = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
const lockFile = migrations.find((f) => /^\d{4}_profile_avatar_lock\.sql$/.test(f));
const read = (p) => readFileSync(join(root, p), 'utf8');
const squash = (s) => s.replace(/--.*$/gm, '').replace(/\s+/g, ' ').toLowerCase();

test('a profile_avatar_lock migration exists and sorts after 0042_chat_quota', () => {
  assert.ok(lockFile, 'missing supabase/migrations/NNNN_profile_avatar_lock.sql');
  assert.ok(lockFile > '0042_chat_quota.sql', `${lockFile} must sort after 0042`);
});

test('the migration scrubs, revokes, constrains and clears on Delete My Data', () => {
  const sql = squash(read(`supabase/migrations/${lockFile}`));
  // The scrub lives in a reusable, owner-only function so pgTAP can seed legacy rows and prove it.
  assert.match(sql, /function public\.scrub_profile_avatar_uris\(\)[\s\S]*update public\.profiles set avatar_uri ?= ?null where avatar_uri is not null/);
  assert.match(sql, /select public\.scrub_profile_avatar_uris\(\);[\s\S]*add constraint profiles_avatar_uri_unused/);
  assert.match(sql, /revoke all on function public\.scrub_profile_avatar_uris\(\) from public, anon, authenticated/);
  assert.match(sql, /revoke insert \(avatar_uri\), update \(avatar_uri\) on (table )?public\.profiles from authenticated, anon/);
  assert.match(sql, /check \(avatar_uri is null\)/);
  const fn = sql.slice(sql.indexOf('function public.delete_my_data()'));
  assert.ok(fn.length < sql.length, 'migration must redefine public.delete_my_data()');
  assert.match(fn.slice(0, fn.indexOf('end; $$')), /avatar_uri ?= ?null/);
});

test('no migration after the lock grants avatar_uri back to a client role', () => {
  for (const f of migrations.filter((m) => m > lockFile)) {
    assert.doesNotMatch(squash(read(`supabase/migrations/${f}`)), /grant [^;]*avatar_uri[^;]* to (authenticated|anon)/, f);
  }
});

test('pgTAP regression covers the scrub, the revoke and server-side deletion', () => {
  const path = 'supabase/tests/profile_avatar_lock.test.sql';
  assert.ok(existsSync(join(root, path)), `missing ${path}`);
  const t = read(path);
  assert.match(t, /has_column_privilege\('authenticated', 'public\.profiles', 'avatar_uri', 'UPDATE'\)/);
  assert.match(t, /throws_ok\([\s\S]*avatar_uri[\s\S]*'42501'/);
  assert.match(t, /delete_my_data\(\)/);
  assert.match(t, /avatar_uri is null/i);
  // Toby round-2: upgraded accounts' legacy file:// paths are seeded and then proven scrubbed.
  assert.match(t, /file:\/\/\/var\/mobile[\s\S]*scrub_profile_avatar_uris\(\)/);
});

test('app code never writes profiles.avatar_uri', () => {
  for (const p of ['src/features/identity/community-profile-repository.ts', 'src/features/data-rights/DataRights.tsx']) {
    assert.doesNotMatch(read(p), /update\(\{[^}]*avatar_uri/, p);
  }
});
