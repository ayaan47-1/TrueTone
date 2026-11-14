// HAG-245: prove, offline and before any deploy, that a pinned Edge Function's committed
// deno.lock actually matches what its deno.json + source currently declare. This does NOT
// prove Supabase's deploy path enforces the lock at bundle time (see docs/ops/edge-function-
// locks.md) — it proves the lock itself isn't stale, hand-edited, or missing an entry for
// something the source imports, which is the precondition any real enforcement would need.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEdgeFunctionLock } from '../check-edge-locks.mjs';

const GOOD_DENO_JSON = {
  imports: { '@supabase/supabase-js': 'npm:@supabase/supabase-js@2.108.2' },
};

const GOOD_DENO_LOCK = {
  version: '5',
  specifiers: { 'npm:@supabase/supabase-js@2.108.2': '2.108.2' },
  npm: {
    '@supabase/supabase-js@2.108.2': { integrity: 'sha512-realhash==' },
  },
  remote: {
    'https://deno.land/std@0.224.0/http/server.ts': 'abc123',
    'https://esm.sh/stripe@14.19.0': 'def456',
  },
  workspace: { dependencies: ['npm:@supabase/supabase-js@2.108.2'] },
};

const GOOD_SOURCE = `
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'https://esm.sh/stripe@14.19.0';
import { helper } from '../_shared/checkout/helper.ts';
`;

function goodFixture(overrides = {}) {
  return {
    name: 'stripe-webhook',
    denoJson: GOOD_DENO_JSON,
    denoLock: GOOD_DENO_LOCK,
    indexSource: GOOD_SOURCE,
    ...overrides,
  };
}

test('accepts a lock that matches deno.json pin, remote imports, and its own workspace deps', () => {
  assert.deepEqual(checkEdgeFunctionLock(goodFixture()), { ok: true });
});

test('relative local imports are never required to appear in the lock', () => {
  const source = GOOD_SOURCE + "\nimport type { Foo } from '../_shared/types.ts';\n";
  assert.deepEqual(checkEdgeFunctionLock(goodFixture({ indexSource: source })), { ok: true });
});

test('throws when deno.lock is missing entirely', () => {
  assert.throws(
    () => checkEdgeFunctionLock(goodFixture({ denoLock: null })),
    /deno\.lock is missing/
  );
});

test('throws when deno.lock reports an unrecognized schema version', () => {
  const lock = { ...GOOD_DENO_LOCK, version: '4' };
  assert.throws(
    () => checkEdgeFunctionLock(goodFixture({ denoLock: lock })),
    /version "4".*expected "5"/s
  );
});

test('throws when deno.json bumped the pin but deno.lock still records the old version', () => {
  // Reproduces the stale-lock scenario the deploy-time gate can't yet prove is caught:
  // deno.json says 2.108.3, but nobody re-ran `deno install` so deno.lock's specifiers
  // map still only has the old 2.108.2 entry.
  const denoJson = { imports: { '@supabase/supabase-js': 'npm:@supabase/supabase-js@2.108.3' } };
  assert.throws(
    () => checkEdgeFunctionLock(goodFixture({ denoJson })),
    /deno\.lock's specifiers has no entry/
  );
});

test('throws when the lock has a specifiers entry but no matching npm integrity block', () => {
  const lock = {
    ...GOOD_DENO_LOCK,
    npm: {}, // hand-edited: specifiers claims 2.108.2 but the integrity hash was never recorded
  };
  assert.throws(
    () => checkEdgeFunctionLock(goodFixture({ denoLock: lock })),
    /no npm integrity entry/
  );
});

test('throws when workspace.dependencies omits a pin that specifiers does record', () => {
  const lock = { ...GOOD_DENO_LOCK, workspace: { dependencies: [] } };
  assert.throws(
    () => checkEdgeFunctionLock(goodFixture({ denoLock: lock })),
    /workspace\.dependencies does not list/
  );
});

test('throws when a remote URL import in source has no matching key in deno.lock.remote', () => {
  // Source was bumped to a newer Stripe SDK version but the lock was never regenerated.
  const source = GOOD_SOURCE.replace('stripe@14.19.0', 'stripe@14.20.0');
  assert.throws(
    () => checkEdgeFunctionLock(goodFixture({ indexSource: source })),
    /no matching remote entry/
  );
});

test('throws when source imports a bare specifier with no import-map entry', () => {
  const source = GOOD_SOURCE + "\nimport { other } from 'some-other-package';\n";
  assert.throws(
    () => checkEdgeFunctionLock(goodFixture({ indexSource: source })),
    /no import-map entry/
  );
});
