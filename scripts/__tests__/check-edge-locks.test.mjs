// HAG-245 round 2 — fixes Scalia's review of 94556da (2 HIGH + 1 MEDIUM,
// hive/research/truetone-thirdparty/review-toby-hag245.md):
//
// 1. (HIGH) Discovery was deno.json-presence-based, so catalog-reconcile and
//    shopify-catalog-webhook (which only import zod via a shared import map, no deno.json)
//    were silently never checked. Now every supabase/functions/*/index.ts (minus _shared) is
//    discovered, and each one must resolve through its own deno.json, a shared import map
//    declared in supabase/config.toml, or an explicit allowlisted-with-a-reason entry — anything
//    else fails, and a discovered set that doesn't match the expected one fails too.
// 2. (HIGH) The old regex-based extractor only caught single-quoted `from '...'`, missing
//    double-quoted imports, `export ... from`, `import type`, and any dynamic import() at all.
//    Now uses the TypeScript compiler API to walk the real AST, and recurses into relative
//    imports so a bare specifier reached only through a _shared/ file (zod, in this repo) is
//    still found. A dynamic import() with a non-literal specifier fails closed.
// 3. (MEDIUM) Lock entries were checked for key presence only, not content. Now the pinned
//    version must be well-formed semver, deno.lock's recorded version for that specifier must
//    equal it, and npm/remote integrity hashes must be non-empty and hash-shaped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectModuleGraphSpecifiers,
  parseFunctionImportMaps,
  resolveFunctionLockConfig,
  assertExpectedFunctionSet,
  validateLockAgainstSpecifiers,
} from '../check-edge-locks.mjs';

// ---------------------------------------------------------------------------
// collectModuleGraphSpecifiers — TypeScript AST walk + relative-import recursion
// ---------------------------------------------------------------------------

function fsFrom(map) {
  return (path) => (path in map ? map[path] : undefined);
}

test('collects a single-quoted static import', () => {
  const fs = fsFrom({ '/fn/index.ts': `import { createClient } from '@supabase/supabase-js';\n` });
  const specs = collectModuleGraphSpecifiers('/fn/index.ts', fs).map((s) => s.specifier);
  assert.deepEqual(specs, ['@supabase/supabase-js']);
});

test('collects a double-quoted static import (Scalia HIGH: formatter-proof)', () => {
  const fs = fsFrom({ '/fn/index.ts': `import Stripe from "https://esm.sh/stripe@14.19.0";\n` });
  const specs = collectModuleGraphSpecifiers('/fn/index.ts', fs).map((s) => s.specifier);
  assert.deepEqual(specs, ['https://esm.sh/stripe@14.19.0']);
});

test('collects import type', () => {
  const fs = fsFrom({ '/fn/index.ts': `import type { Foo } from 'npm:some-types@1.0.0';\n` });
  const specs = collectModuleGraphSpecifiers('/fn/index.ts', fs).map((s) => s.specifier);
  assert.deepEqual(specs, ['npm:some-types@1.0.0']);
});

test('collects export ... from', () => {
  const fs = fsFrom({ '/fn/index.ts': `export { helper } from 'https://esm.sh/new@1.0.0';\n` });
  const specs = collectModuleGraphSpecifiers('/fn/index.ts', fs).map((s) => s.specifier);
  assert.deepEqual(specs, ['https://esm.sh/new@1.0.0']);
});

test('collects a dynamic import() with a string-literal specifier', () => {
  const fs = fsFrom({ '/fn/index.ts': `const m = await import('https://esm.sh/dyn@1.0.0');\n` });
  const specs = collectModuleGraphSpecifiers('/fn/index.ts', fs).map((s) => s.specifier);
  assert.deepEqual(specs, ['https://esm.sh/dyn@1.0.0']);
});

test('throws on a dynamic import() whose specifier is not a string literal', () => {
  const fs = fsFrom({ '/fn/index.ts': `const target = pick(); const m = await import(target);\n` });
  assert.throws(() => collectModuleGraphSpecifiers('/fn/index.ts', fs), /non-string-literal specifier/);
});

test('recurses into a relative import and collects its transitive dependencies', () => {
  // Reproduces the real catalog-reconcile/shopify-catalog-webhook shape: index.ts has no
  // remote imports of its own, but a _shared file it imports does.
  const fs = fsFrom({
    '/fn/index.ts': `import { run } from '../_shared/catalog/runtime.ts';\n`,
    '/_shared/catalog/runtime.ts': `import { z } from 'zod';\nexport const run = () => z;\n`,
  });
  const specs = collectModuleGraphSpecifiers('/fn/index.ts', fs).map((s) => s.specifier);
  assert.deepEqual(specs, ['zod']);
});

test('does not require a relative import type target to exist (erased before runtime)', () => {
  // Real repo quirk (supabase/functions/_shared/match/product-catalog.ts): a type-only
  // import omits the .ts extension. It's erased before Deno ever loads the module graph, so
  // it must not need to resolve, unlike a value import to the same kind of missing path.
  const fs = fsFrom({ '/fn/index.ts': `import type { Product } from '../_shared/match/match-types';\n` });
  const specs = collectModuleGraphSpecifiers('/fn/index.ts', fs);
  assert.deepEqual(specs, []);
});

test('throws when a relative import target cannot be read (broken graph)', () => {
  const fs = fsFrom({ '/fn/index.ts': `import { run } from '../_shared/missing.ts';\n` });
  assert.throws(() => collectModuleGraphSpecifiers('/fn/index.ts', fs), /cannot read/);
});

test('does not infinitely recurse on a circular relative import', () => {
  const fs = fsFrom({
    '/fn/a.ts': `import 'npm:leaf@1.0.0';\nimport './b.ts';\n`,
    '/fn/b.ts': `import './a.ts';\n`,
  });
  const specs = collectModuleGraphSpecifiers('/fn/a.ts', fs).map((s) => s.specifier);
  assert.deepEqual(specs, ['npm:leaf@1.0.0']);
});

// ---------------------------------------------------------------------------
// parseFunctionImportMaps — supabase/config.toml's [functions.<name>] import_map lines
// ---------------------------------------------------------------------------

test('parses import_map entries scoped to their own [functions.<name>] section', () => {
  const toml = `
project_id = "TrueTone"

[functions.shopify-catalog-webhook]
verify_jwt = false
import_map = "./functions/catalog-import-map.json"

[functions.catalog-reconcile]
verify_jwt = false
import_map = "./functions/catalog-import-map.json"

[api]
enabled = true
port = 54321
`;
  assert.deepEqual(parseFunctionImportMaps(toml), {
    'shopify-catalog-webhook': './functions/catalog-import-map.json',
    'catalog-reconcile': './functions/catalog-import-map.json',
  });
});

test('ignores a function section with no import_map line', () => {
  const toml = `[functions.stripe-webhook]\nverify_jwt = true\n`;
  assert.deepEqual(parseFunctionImportMaps(toml), {});
});

// ---------------------------------------------------------------------------
// resolveFunctionLockConfig — the three legitimate discovery paths
// ---------------------------------------------------------------------------

test('resolves via its own deno.json when present', () => {
  const result = resolveFunctionLockConfig('stripe-webhook', {
    hasOwnDenoJson: true,
    importMapByFunction: {},
    allowlist: {},
  });
  assert.equal(result.mode, 'own');
});

test('resolves via a declared shared import map when no own deno.json exists', () => {
  const result = resolveFunctionLockConfig('catalog-reconcile', {
    hasOwnDenoJson: false,
    importMapByFunction: { 'catalog-reconcile': './functions/catalog-import-map.json' },
    allowlist: {},
  });
  assert.equal(result.mode, 'shared');
  assert.equal(result.importMapPath, './functions/catalog-import-map.json');
});

test('resolves via an explicit allowlist entry with a reason', () => {
  const result = resolveFunctionLockConfig('legacy-fn', {
    hasOwnDenoJson: false,
    importMapByFunction: {},
    allowlist: { 'legacy-fn': 'no remote imports at all, verified 2026-11-14' },
  });
  assert.equal(result.mode, 'allowlisted');
  assert.equal(result.reason, 'no remote imports at all, verified 2026-11-14');
});

test('throws when none of the three paths apply (Scalia HIGH: no silent skip)', () => {
  assert.throws(
    () =>
      resolveFunctionLockConfig('mystery-fn', {
        hasOwnDenoJson: false,
        importMapByFunction: {},
        allowlist: {},
      }),
    /no deno\.json, no configured shared import map.*not in the allowlist/s
  );
});

// ---------------------------------------------------------------------------
// assertExpectedFunctionSet — zero-functions-found and silent-removal guard
// ---------------------------------------------------------------------------

test('passes when the discovered set matches the expected set, any order', () => {
  assert.doesNotThrow(() => assertExpectedFunctionSet(['b', 'a'], ['a', 'b']));
});

test('throws when a function disappears from discovery', () => {
  assert.throws(() => assertExpectedFunctionSet(['a'], ['a', 'b']), /does not match/);
});

test('throws when zero functions are discovered, even if none were expected', () => {
  assert.throws(() => assertExpectedFunctionSet([], []), /zero/i);
});

// ---------------------------------------------------------------------------
// validateLockAgainstSpecifiers — lock-vs-declared-imports content validation
// ---------------------------------------------------------------------------

const GOOD_DENO_JSON = {
  imports: { '@supabase/supabase-js': 'npm:@supabase/supabase-js@2.108.2' },
};

// Real deno.lock v5 hash shapes: npm integrity is SRI sha512 (base64 of 64 bytes is always
// exactly 86 significant chars + "==" padding); remote entries are 64-char lowercase hex
// SHA-256. Placeholder digits/letters below are shape-valid, not real hashes.
const GOOD_SHA512 = `sha512-${'A'.repeat(86)}==`;
const GOOD_SHA256 = 'a'.repeat(64);

const GOOD_DENO_LOCK = {
  version: '5',
  specifiers: { 'npm:@supabase/supabase-js@2.108.2': '2.108.2' },
  npm: {
    '@supabase/supabase-js@2.108.2': { integrity: GOOD_SHA512 },
  },
  remote: {
    'https://deno.land/std@0.224.0/http/server.ts': GOOD_SHA256,
    'https://esm.sh/stripe@14.19.0': GOOD_SHA256,
  },
  workspace: { dependencies: ['npm:@supabase/supabase-js@2.108.2'] },
};

const GOOD_SPECIFIERS = [
  'https://deno.land/std@0.224.0/http/server.ts',
  '@supabase/supabase-js',
  'https://esm.sh/stripe@14.19.0',
];

function goodFixture(overrides = {}) {
  return {
    name: 'stripe-webhook',
    denoJson: GOOD_DENO_JSON,
    denoLock: GOOD_DENO_LOCK,
    specifiers: GOOD_SPECIFIERS,
    ...overrides,
  };
}

test('accepts a lock that matches the pin, its content, and remote imports', () => {
  assert.deepEqual(validateLockAgainstSpecifiers(goodFixture()), { ok: true });
});

test('throws when deno.lock is missing entirely', () => {
  assert.throws(() => validateLockAgainstSpecifiers(goodFixture({ denoLock: null })), /deno\.lock is missing/);
});

test('throws when deno.lock reports an unrecognized schema version', () => {
  const lock = { ...GOOD_DENO_LOCK, version: '4' };
  assert.throws(
    () => validateLockAgainstSpecifiers(goodFixture({ denoLock: lock })),
    /version "4".*expected "5"/s
  );
});

test('throws when deno.json pins a malformed (non-exact-semver) version', () => {
  const denoJson = { imports: { '@supabase/supabase-js': 'npm:@supabase/supabase-js@^2.108.2' } };
  assert.throws(() => validateLockAgainstSpecifiers(goodFixture({ denoJson })), /malformed/i);
});

test('throws when deno.lock has no specifiers entry for the pin', () => {
  const denoJson = { imports: { '@supabase/supabase-js': 'npm:@supabase/supabase-js@2.108.3' } };
  assert.throws(
    () => validateLockAgainstSpecifiers(goodFixture({ denoJson })),
    /specifiers has no entry/
  );
});

test('throws when specifiers records a different version than the pin (Scalia MEDIUM)', () => {
  // The exact probe from the review: specifiers['npm:pkg@1.2.3'] = '0.0.0'.
  const denoJson = { imports: { pkg: 'npm:pkg@1.2.3' } };
  const lock = {
    version: '5',
    specifiers: { 'npm:pkg@1.2.3': '0.0.0' },
    npm: { 'pkg@1.2.3': { integrity: GOOD_SHA512 } },
    remote: {},
    workspace: { dependencies: ['npm:pkg@1.2.3'] },
  };
  assert.throws(
    () => validateLockAgainstSpecifiers({ name: 'fn', denoJson, denoLock: lock, specifiers: ['pkg'] }),
    /specifiers\['npm:pkg@1\.2\.3'\] is '0\.0\.0', expected it to match/
  );
});

test('throws when workspace.dependencies omits a pin that specifiers does record', () => {
  const lock = { ...GOOD_DENO_LOCK, workspace: { dependencies: [] } };
  assert.throws(
    () => validateLockAgainstSpecifiers(goodFixture({ denoLock: lock })),
    /workspace\.dependencies does not list/
  );
});

test('throws when npm has no integrity entry at all for the pinned version', () => {
  const lock = { ...GOOD_DENO_LOCK, npm: {} };
  assert.throws(
    () => validateLockAgainstSpecifiers(goodFixture({ denoLock: lock })),
    /no npm integrity entry/
  );
});

test('throws when npm integrity is present but empty (Scalia MEDIUM exact probe)', () => {
  const denoJson = { imports: { pkg: 'npm:pkg@1.2.3' } };
  const lock = {
    version: '5',
    specifiers: { 'npm:pkg@1.2.3': '1.2.3' },
    npm: { 'pkg@1.2.3': { integrity: '' } },
    remote: {},
    workspace: { dependencies: ['npm:pkg@1.2.3'] },
  };
  assert.throws(
    () => validateLockAgainstSpecifiers({ name: 'fn', denoJson, denoLock: lock, specifiers: ['pkg'] }),
    /no valid integrity hash/
  );
});

test('throws when npm integrity looks hash-like but is not a valid SRI sha512 digest (Scalia round 2 MEDIUM probe)', () => {
  // The exact probe: 'abcdefgh' is 8 non-whitespace chars, so it used to pass under the old
  // "long enough to look real" check. It is not sha512-shaped at all.
  const denoJson = { imports: { pkg: 'npm:pkg@1.2.3' } };
  const lock = {
    version: '5',
    specifiers: { 'npm:pkg@1.2.3': '1.2.3' },
    npm: { 'pkg@1.2.3': { integrity: 'abcdefgh' } },
    remote: {},
    workspace: { dependencies: ['npm:pkg@1.2.3'] },
  };
  assert.throws(
    () => validateLockAgainstSpecifiers({ name: 'fn', denoJson, denoLock: lock, specifiers: ['pkg'] }),
    /no valid integrity hash/
  );
});

test('rejects an sha1-shaped (or otherwise wrong-algorithm) npm integrity value', () => {
  const denoJson = { imports: { pkg: 'npm:pkg@1.2.3' } };
  const lock = {
    version: '5',
    specifiers: { 'npm:pkg@1.2.3': '1.2.3' },
    npm: { 'pkg@1.2.3': { integrity: `sha1-${'A'.repeat(27)}=` } },
    remote: {},
    workspace: { dependencies: ['npm:pkg@1.2.3'] },
  };
  assert.throws(
    () => validateLockAgainstSpecifiers({ name: 'fn', denoJson, denoLock: lock, specifiers: ['pkg'] }),
    /no valid integrity hash/
  );
});

test('throws when a remote URL import has no matching key in deno.lock.remote', () => {
  assert.throws(
    () =>
      validateLockAgainstSpecifiers(
        goodFixture({ specifiers: [...GOOD_SPECIFIERS, 'https://esm.sh/stripe@14.20.0'] })
      ),
    /no matching remote entry/
  );
});

test('throws when a remote entry has an empty/malformed hash', () => {
  const lock = {
    ...GOOD_DENO_LOCK,
    remote: { ...GOOD_DENO_LOCK.remote, 'https://esm.sh/stripe@14.19.0': '' },
  };
  assert.throws(
    () => validateLockAgainstSpecifiers(goodFixture({ denoLock: lock })),
    /malformed remote hash/
  );
});

// The import-map-resolved-to-a-remote-URL branch (a deno.json import-map target that is a raw
// URL pin, not an npm: specifier) had zero test coverage before this round — Scalia's round 2
// MEDIUM exact probe was an empty-string hash there passing silently.
test('accepts an import-map specifier that resolves to a remote URL with a valid remote-entry hash', () => {
  const denoJson = { imports: { pinned: 'https://esm.sh/pinned@1.0.0' } };
  const lock = {
    version: '5',
    specifiers: {},
    npm: {},
    remote: { 'https://esm.sh/pinned@1.0.0': GOOD_SHA256 },
    workspace: { dependencies: [] },
  };
  assert.deepEqual(
    validateLockAgainstSpecifiers({ name: 'fn', denoJson, denoLock: lock, specifiers: ['pinned'] }),
    { ok: true }
  );
});

test('throws when an import-map-resolved remote URL has an empty hash (Scalia round 2 MEDIUM exact probe)', () => {
  const denoJson = { imports: { pinned: 'https://esm.sh/pinned@1.0.0' } };
  const lock = {
    version: '5',
    specifiers: {},
    npm: {},
    remote: { 'https://esm.sh/pinned@1.0.0': '' },
    workspace: { dependencies: [] },
  };
  assert.throws(
    () => validateLockAgainstSpecifiers({ name: 'fn', denoJson, denoLock: lock, specifiers: ['pinned'] }),
    /malformed remote hash/
  );
});

test('throws when an import-map-resolved remote URL has a non-sha256-shaped hash', () => {
  const denoJson = { imports: { pinned: 'https://esm.sh/pinned@1.0.0' } };
  const lock = {
    version: '5',
    specifiers: {},
    npm: {},
    remote: { 'https://esm.sh/pinned@1.0.0': 'not-a-real-digest' },
    workspace: { dependencies: [] },
  };
  assert.throws(
    () => validateLockAgainstSpecifiers({ name: 'fn', denoJson, denoLock: lock, specifiers: ['pinned'] }),
    /malformed remote hash/
  );
});

test('throws when source imports a bare specifier with no import-map entry', () => {
  assert.throws(
    () => validateLockAgainstSpecifiers(goodFixture({ specifiers: [...GOOD_SPECIFIERS, 'some-other-package'] })),
    /no import-map entry/
  );
});
