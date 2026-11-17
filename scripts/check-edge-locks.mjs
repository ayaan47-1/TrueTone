// scripts/check-edge-locks.mjs
//
// HAG-245: before any Edge Function deploy, prove the committed deno.lock actually matches
// what deno.json (or a shared import map) + the function's full module graph currently
// declare. This is deliberately offline and local-only (no network, no supabase functions
// deploy): it does not prove the Supabase/edge-runtime deploy path enforces the lock at bundle
// time (that gate is unresolved, see docs/ops/edge-function-locks.md). It proves the lock
// itself is not stale, hand-edited, incomplete, or silently unchecked — the precondition any
// real enforcement would need, and the thing that can drift (or be missed) silently between
// commits today.
//
// Round 2 fixes Scalia's review of 94556da: discovery is now index.ts-based (not deno.json-
// presence-based), import extraction walks the real TypeScript AST through the whole relative-
// import graph instead of a single-quote regex, and lock entries are checked by content, not
// just key presence. See the test file's header for the full mapping to each finding.
import ts from 'typescript';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';

const SUPPORTED_LOCK_VERSION = '5';
const EXACT_SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
// deno.lock v5's npm integrity is a standard SRI sha512 digest: base64 of 64 bytes is always
// exactly 86 significant characters plus "==" padding. Any other length or algorithm (sha1,
// truncated/garbage strings) is rejected rather than accepted as "long enough to look real".
const NPM_INTEGRITY_SHA512 = /^sha512-[A-Za-z0-9+/]{86}==$/;
// deno.lock v5's remote entries are always a raw SHA-256 hex digest (64 lowercase hex chars) —
// applies to a direct remote URL import and to an import-map specifier that resolves to a
// remote URL (as opposed to an npm: specifier).
const REMOTE_HASH_SHA256 = /^[0-9a-f]{64}$/;

// ---------------------------------------------------------------------------
// 1. Module graph walk (TypeScript AST) — Scalia HIGH #2
// ---------------------------------------------------------------------------

/**
 * Walks index.ts (and, transitively, every relative import it reaches) using the TypeScript
 * compiler API, returning every non-relative (remote URL or bare/npm) specifier found via
 * static import, `export ... from`, `import type`, or a dynamic `import()` with a string-
 * literal argument. Throws on a dynamic import() whose specifier isn't a literal (can't be
 * statically verified) or on a relative import target that can't be read (broken graph).
 */
export function collectModuleGraphSpecifiers(entryPath, readFile, visited = new Set()) {
  if (visited.has(entryPath)) return [];
  visited.add(entryPath);

  const source = readFile(entryPath);
  if (source === undefined) {
    throw new Error(`cannot read '${entryPath}' — broken import graph`);
  }

  const sourceFile = ts.createSourceFile(entryPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found = [];

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      const isTypeOnly = ts.isImportDeclaration(node)
        ? node.importClause?.isTypeOnly === true
        : node.isTypeOnly === true;
      found.push({ text: node.moduleSpecifier.text, isTypeOnly });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteralLike(arg)) {
        found.push({ text: arg.text, isTypeOnly: false });
      } else {
        throw new Error(
          `${entryPath}: dynamic import() has a non-string-literal specifier — cannot verify its target statically`
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const results = [];
  for (const { text: specifier, isTypeOnly } of found) {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      // A type-only relative import is erased before Deno ever loads the module graph, so it
      // is never required to resolve (this repo has at least one that omits its extension).
      if (isTypeOnly) continue;
      const resolvedPath = normalize(join(dirname(entryPath), specifier));
      results.push(...collectModuleGraphSpecifiers(resolvedPath, readFile, visited));
    } else {
      results.push({ specifier, fromFile: entryPath });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// 2. Discovery — Scalia HIGH #1
// ---------------------------------------------------------------------------

/** Parses the `import_map = "..."` line inside each `[functions.<name>]` section of a
 * supabase/config.toml-shaped string. Deliberately minimal: this repo's config.toml only ever
 * needs scalar string assignments inside bracketed sections. */
export function parseFunctionImportMaps(tomlText) {
  const result = {};
  let currentFn = null;
  for (const raw of tomlText.split('\n')) {
    const line = raw.trim();
    const section = line.match(/^\[functions\.([^\]]+)\]$/);
    if (section) {
      currentFn = section[1];
      continue;
    }
    if (line.startsWith('[')) {
      currentFn = null;
      continue;
    }
    if (currentFn) {
      const importMap = line.match(/^import_map\s*=\s*"([^"]+)"$/);
      if (importMap) result[currentFn] = importMap[1];
    }
  }
  return result;
}

/** The three legitimate ways a function can resolve its lock config; anything else fails
 * closed rather than being silently skipped. */
export function resolveFunctionLockConfig(name, { hasOwnDenoJson, importMapByFunction, allowlist }) {
  if (hasOwnDenoJson) return { mode: 'own' };
  if (importMapByFunction[name]) return { mode: 'shared', importMapPath: importMapByFunction[name] };
  if (allowlist[name]) return { mode: 'allowlisted', reason: allowlist[name] };
  throw new Error(
    `${name}: no deno.json, no configured shared import map in supabase/config.toml, and ` +
      'not in the allowlist — cannot verify its dependency lock'
  );
}

/** Fails if the discovered function set doesn't match what the script expects — catches a
 * function silently disappearing from discovery (e.g. its index.ts or dir removed without
 * updating this list) as loudly as a newly-added, not-yet-reviewed one. Also fails on zero
 * functions, even if the expected set itself were somehow empty. */
export function assertExpectedFunctionSet(discoveredNames, expectedNames) {
  const discovered = [...discoveredNames].sort();
  const expected = [...expectedNames].sort();
  if (discovered.length === 0) {
    throw new Error('zero Edge Functions were discovered — refusing to report success for an empty check');
  }
  if (JSON.stringify(discovered) !== JSON.stringify(expected)) {
    throw new Error(
      `discovered function set ${JSON.stringify(discovered)} does not match expected set ` +
        `${JSON.stringify(expected)} — update EXPECTED_FUNCTIONS in scripts/check-edge-locks.mjs ` +
        'if a function was intentionally added or removed'
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Lock content validation — Scalia MEDIUM
// ---------------------------------------------------------------------------

export function validateLockAgainstSpecifiers({ name, denoJson, denoLock, specifiers }) {
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
  const lockSpecifiers = denoLock.specifiers ?? {};
  const npmEntries = denoLock.npm ?? {};
  const remoteEntries = denoLock.remote ?? {};
  const workspaceDeps = denoLock.workspace?.dependencies ?? [];

  const uniqueSpecifiers = [...new Set(specifiers)];

  for (const spec of uniqueSpecifiers) {
    if (spec.startsWith('http://') || spec.startsWith('https://')) {
      const hash = remoteEntries[spec];
      if (hash === undefined) {
        throw new Error(
          `${name}: source imports '${spec}' but deno.lock has no matching remote entry — ` +
            'the lock is stale or was never regenerated for this import'
        );
      }
      if (typeof hash !== 'string' || !REMOTE_HASH_SHA256.test(hash)) {
        throw new Error(`${name}: deno.lock has a malformed remote hash for '${spec}' (got ${JSON.stringify(hash)})`);
      }
      continue;
    }

    const resolved = imports[spec];
    if (!resolved) {
      throw new Error(`${name}: source imports '${spec}' but deno.json has no import-map entry for it`);
    }

    if (!resolved.startsWith('npm:')) {
      // An import-map target that isn't an npm: specifier (a raw URL pin, say) is checked the
      // same way a direct remote import is, against deno.lock.remote — including validating the
      // hash's shape, not just that a key exists (an empty-string entry must not pass).
      const hash = remoteEntries[resolved];
      if (hash === undefined) {
        throw new Error(
          `${name}: deno.json resolves '${spec}' to '${resolved}', but deno.lock has no matching remote entry`
        );
      }
      if (typeof hash !== 'string' || !REMOTE_HASH_SHA256.test(hash)) {
        throw new Error(
          `${name}: deno.json resolves '${spec}' to '${resolved}', but deno.lock has a malformed ` +
            `remote hash for it (got ${JSON.stringify(hash)})`
        );
      }
      continue;
    }

    const pkgAtVersion = resolved.slice('npm:'.length);
    const pinnedVersion = pkgAtVersion.slice(pkgAtVersion.lastIndexOf('@') + 1);
    if (!EXACT_SEMVER.test(pinnedVersion)) {
      throw new Error(`${name}: deno.json pins '${spec}' to a malformed version '${pinnedVersion}'`);
    }

    if (!(resolved in lockSpecifiers)) {
      throw new Error(
        `${name}: deno.json pins '${spec}' to '${resolved}', but deno.lock's specifiers has ` +
          'no entry for it — the lock does not match the declared pin'
      );
    }

    const lockVersion = lockSpecifiers[resolved];
    if (lockVersion !== pinnedVersion) {
      throw new Error(
        `${name}: deno.lock's specifiers['${resolved}'] is '${lockVersion}', expected it to ` +
          `match the pinned version '${pinnedVersion}'`
      );
    }

    if (!workspaceDeps.includes(resolved)) {
      throw new Error(
        `${name}: deno.lock's workspace.dependencies does not list '${resolved}' even though ` +
          'specifiers does — internally inconsistent lock'
      );
    }

    const npmEntry = npmEntries[pkgAtVersion];
    if (!npmEntry) {
      throw new Error(
        `${name}: deno.lock has no npm integrity entry for '${pkgAtVersion}' even though it ` +
          'is the pinned version — the lock may have been hand-edited rather than regenerated'
      );
    }
    if (typeof npmEntry.integrity !== 'string' || !NPM_INTEGRITY_SHA512.test(npmEntry.integrity)) {
      throw new Error(
        `${name}: deno.lock has no valid integrity hash for '${pkgAtVersion}' ` +
          `(got ${JSON.stringify(npmEntry.integrity)})`
      );
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// CLI wiring
// ---------------------------------------------------------------------------

const SUPABASE_DIR = join(process.cwd(), 'supabase');
const FUNCTIONS_DIR = join(SUPABASE_DIR, 'functions');

// Functions deliberately exempted from own/shared lock enforcement, with a documented reason.
// Empty today — both catalog functions resolve through a shared import map (see below), and a
// gap there is reported as a real failure, not silently allowlisted away.
const ALLOWLIST = {};

const EXPECTED_FUNCTIONS = [
  'catalog-reconcile',
  'create-payment-intent',
  'routine-chat',
  'shopify-catalog-webhook',
  'stripe-webhook',
];

function loadJSON(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

function fsReadFile(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
}

function discoverDeployableFunctionNames() {
  if (!existsSync(FUNCTIONS_DIR)) return [];
  return readdirSync(FUNCTIONS_DIR).filter((name) => {
    if (name === '_shared') return false;
    const dir = join(FUNCTIONS_DIR, name);
    return statSync(dir).isDirectory() && existsSync(join(dir, 'index.ts'));
  });
}

function scan() {
  const names = discoverDeployableFunctionNames();

  try {
    assertExpectedFunctionSet(names, EXPECTED_FUNCTIONS);
  } catch (err) {
    console.error('EDGE FUNCTION LOCK MISMATCH:\n' + err.message);
    process.exit(1);
  }

  const importMapByFunction = parseFunctionImportMaps(fsReadFile(join(SUPABASE_DIR, 'config.toml')) ?? '');
  const failures = [];
  const checked = [];

  for (const name of names) {
    const dir = join(FUNCTIONS_DIR, name);
    try {
      const config = resolveFunctionLockConfig(name, {
        hasOwnDenoJson: existsSync(join(dir, 'deno.json')),
        importMapByFunction,
        allowlist: ALLOWLIST,
      });

      if (config.mode === 'allowlisted') {
        console.log(`compliance: ${name} is allowlisted (${config.reason}) — not lock-checked`);
        continue;
      }

      const denoJsonPath = config.mode === 'own' ? join(dir, 'deno.json') : join(SUPABASE_DIR, config.importMapPath);
      const denoLockPath = join(dirname(denoJsonPath), 'deno.lock');

      if (!existsSync(denoLockPath)) {
        throw new Error(
          `${name}: resolves through '${denoJsonPath}' but no deno.lock is committed at '${denoLockPath}'`
        );
      }

      const specifiers = collectModuleGraphSpecifiers(join(dir, 'index.ts'), fsReadFile).map((s) => s.specifier);

      validateLockAgainstSpecifiers({
        name,
        denoJson: loadJSON(denoJsonPath),
        denoLock: loadJSON(denoLockPath),
        specifiers,
      });
      checked.push(name);
    } catch (err) {
      failures.push(err.message);
    }
  }

  if (failures.length) {
    console.error('EDGE FUNCTION LOCK MISMATCH:\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log(`compliance: deno.lock matches declared imports for ${checked.length} edge function(s): ${checked.join(', ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) scan();
