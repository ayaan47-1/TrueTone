// scripts/check-edge-locks.mjs
//
// HAG-245: before any Edge Function deploy, prove the committed deno.lock actually matches
// what deno.json + the function's source currently declare. This is deliberately offline and
// local-only (no network, no supabase functions deploy): it does not prove the Supabase/
// edge-runtime deploy path enforces the lock at bundle time (that gate is unresolved, see
// docs/ops/edge-function-locks.md). It proves the lock itself is not stale, hand-edited, or
// missing an entry for something the source imports — the precondition any real enforcement
// would need, and the thing that can drift silently between commits today.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SUPPORTED_LOCK_VERSION = '5';

function extractSourceSpecifiers(source) {
  return [...source.matchAll(/(?:from|import)\s+'([^']+)'/g)].map((m) => m[1]);
}

export function checkEdgeFunctionLock({ name, denoJson, denoLock, indexSource }) {
  if (!denoLock) {
    throw new Error(
      `${name}: deno.lock is missing — cannot verify the committed lock matches declared imports`
    );
  }
  if (denoLock.version !== SUPPORTED_LOCK_VERSION) {
    throw new Error(
      `${name}: deno.lock reports version "${denoLock.version}", expected ` +
        `"${SUPPORTED_LOCK_VERSION}" — refusing to trust an unrecognized lock schema`
    );
  }

  const imports = denoJson?.imports ?? {};
  const specifiers = denoLock.specifiers ?? {};
  const npmEntries = denoLock.npm ?? {};
  const remoteEntries = denoLock.remote ?? {};
  const workspaceDeps = denoLock.workspace?.dependencies ?? [];

  for (const spec of extractSourceSpecifiers(indexSource)) {
    if (spec.startsWith('.') || spec.startsWith('/')) continue; // local file, not a dependency

    if (spec.startsWith('http://') || spec.startsWith('https://')) {
      if (!(spec in remoteEntries)) {
        throw new Error(
          `${name}: source imports '${spec}' but deno.lock has no matching remote entry — ` +
            'the lock is stale or was never regenerated for this import'
        );
      }
      continue;
    }

    const resolved = imports[spec];
    if (!resolved) {
      throw new Error(`${name}: source imports '${spec}' but deno.json has no import-map entry for it`);
    }

    if (!(resolved in specifiers)) {
      throw new Error(
        `${name}: deno.json pins '${spec}' to '${resolved}', but deno.lock's specifiers has ` +
          'no entry for it — the lock does not match the declared pin'
      );
    }

    if (!workspaceDeps.includes(resolved)) {
      throw new Error(
        `${name}: deno.lock's workspace.dependencies does not list '${resolved}' even though ` +
          'specifiers does — internally inconsistent lock'
      );
    }

    if (resolved.startsWith('npm:')) {
      const pkgAtVersion = resolved.slice('npm:'.length);
      if (!(pkgAtVersion in npmEntries)) {
        throw new Error(
          `${name}: deno.lock has no npm integrity entry for '${pkgAtVersion}' even though it ` +
            'is the pinned version — the lock may have been hand-edited rather than regenerated'
        );
      }
    }
  }

  return { ok: true };
}

const FUNCTIONS_DIR = join(process.cwd(), 'supabase', 'functions');

function loadJSON(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

function discoverPinnedFunctions() {
  if (!existsSync(FUNCTIONS_DIR)) return [];
  return readdirSync(FUNCTIONS_DIR).filter((name) => {
    const dir = join(FUNCTIONS_DIR, name);
    return statSync(dir).isDirectory() && existsSync(join(dir, 'deno.json'));
  });
}

function scan() {
  const names = discoverPinnedFunctions();
  const failures = [];
  for (const name of names) {
    const dir = join(FUNCTIONS_DIR, name);
    try {
      checkEdgeFunctionLock({
        name,
        denoJson: loadJSON(join(dir, 'deno.json')),
        denoLock: loadJSON(join(dir, 'deno.lock')),
        indexSource: readFileSync(join(dir, 'index.ts'), 'utf8'),
      });
    } catch (err) {
      failures.push(err.message);
    }
  }
  if (failures.length) {
    console.error('EDGE FUNCTION LOCK MISMATCH:\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log(
    `compliance: deno.lock matches declared imports for ${names.length} edge function(s): ${names.join(', ')}`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) scan();
