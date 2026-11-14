// HAG-245 follow-up: catalog-reconcile and shopify-catalog-webhook resolve their only
// third-party dependency (zod) through the SHARED import map supabase/functions/
// catalog-import-map.json (supabase/config.toml [functions.<name>].import_map), not a
// per-function deno.json. This proves the real repo's shared deno.lock actually covers
// both functions end to end, using check-edge-locks.mjs's own exported functions against
// real files on disk — not a synthetic fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  collectModuleGraphSpecifiers,
  parseFunctionImportMaps,
  resolveFunctionLockConfig,
  validateLockAgainstSpecifiers,
} from '../check-edge-locks.mjs';

const SUPABASE_DIR = join(import.meta.dirname, '../../supabase');
const FUNCTIONS_DIR = join(SUPABASE_DIR, 'functions');
const CATALOG_FUNCTIONS = ['catalog-reconcile', 'shopify-catalog-webhook'];

function fsReadFile(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
}
function loadJSON(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

for (const name of CATALOG_FUNCTIONS) {
  const dir = join(FUNCTIONS_DIR, name);

  test(`${name}: config.toml points it at the shared catalog import map, not its own deno.json`, () => {
    assert.equal(existsSync(join(dir, 'deno.json')), false);
    const importMapByFunction = parseFunctionImportMaps(fsReadFile(join(SUPABASE_DIR, 'config.toml')));
    const config = resolveFunctionLockConfig(name, {
      hasOwnDenoJson: false,
      importMapByFunction,
      allowlist: {},
    });
    assert.equal(config.mode, 'shared');
    assert.equal(config.importMapPath, './functions/catalog-import-map.json');
  });

  test(`${name}: resolves through a committed shared deno.lock that matches its module graph`, () => {
    const importMapByFunction = parseFunctionImportMaps(fsReadFile(join(SUPABASE_DIR, 'config.toml')));
    const config = resolveFunctionLockConfig(name, { hasOwnDenoJson: false, importMapByFunction, allowlist: {} });
    const denoJsonPath = join(SUPABASE_DIR, config.importMapPath);
    const denoLockPath = join(dirname(denoJsonPath), 'deno.lock');

    assert.ok(existsSync(denoLockPath), `shared deno.lock missing at ${denoLockPath}`);

    const specifiers = collectModuleGraphSpecifiers(join(dir, 'index.ts'), fsReadFile).map((s) => s.specifier);
    assert.ok(specifiers.includes('zod'), `${name} should reach zod transitively through _shared`);

    assert.doesNotThrow(() =>
      validateLockAgainstSpecifiers({
        name,
        denoJson: loadJSON(denoJsonPath),
        denoLock: loadJSON(denoLockPath),
        specifiers,
      })
    );
  });
}

test('the shared catalog deno.lock pins the exact zod version declared in catalog-import-map.json', () => {
  const importMap = loadJSON(join(FUNCTIONS_DIR, 'catalog-import-map.json'));
  const pin = importMap.imports.zod;
  assert.match(pin, /^npm:zod@\d+\.\d+\.\d+$/, `zod pin should be an exact version, got '${pin}'`);

  const lock = loadJSON(join(FUNCTIONS_DIR, 'deno.lock'));
  assert.ok(lock, 'shared deno.lock missing');
  assert.equal(lock.version, '5');
  const version = pin.slice('npm:zod@'.length);
  assert.equal(lock.specifiers[pin], version);
  assert.ok(lock.npm[`zod@${version}`]?.integrity, 'lock has no integrity hash for the pinned zod version');
});
