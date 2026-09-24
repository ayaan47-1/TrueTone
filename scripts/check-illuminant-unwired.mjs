// scripts/check-illuminant-unwired.mjs
//
// Enforces a deliberate retirement decision, not just a code comment. `cv/illuminant.ts` is
// implemented, unit-tested, and correct for what it does (skin-locus illuminant estimation,
// melanin-orthogonal projection so tone never masquerades as colour cast) -- but Task 12 / Task
// 12b measured that wiring it into the live score path REGRESSES the darkSpots/redness
// illuminant-axis metric (0.1115 -> 0.2462) rather than improving it, because this renderer's
// Planckian illuminant direction and its melanin direction are ~93% collinear in
// log-chromaticity: after the fairness-required melanin projection, almost no correctly-signed
// colour-cast signal is left to correct, and the dominant real-world error source is exposure
// (intensity), not illuminant colour -- a dimension this chroma-ratio estimator is invariant to
// by construction and cannot touch. See `cv/illuminant.ts`'s header and
// `cv/__tests__/illuminant.test.ts`'s `normalizeIlluminant` describe block for the full
// reasoning and measurements.
//
// This script makes that decision structurally enforced: if a future change imports
// `cv/illuminant.ts` into the live read pipeline, this fails loudly in CI (`test:scripts` /
// `check:compliance`) instead of silently reintroducing a measured regression. Wiring it back in
// deliberately (e.g. once a real exposure-normalization fix exists) is still possible -- just
// requires updating this script's allowlist alongside the code, not doing it by accident.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

// The live read pipeline. `cv/illuminant.ts` itself and its test are excluded on purpose --
// only files that could actually run during a real scan are checked.
const GUARDED_DIRS = ['src/features/read'];
const EXCLUDE_PATH_PARTS = ['__tests__', join('cv', 'illuminant.ts')];
// Matches `from '.../illuminant'` or `require('.../illuminant')`, either quote style --
// deliberately narrower than a bare "illuminant" text search, which would false-positive on the
// many legitimate illuminant-axis MEASUREMENT comments in calibration.ts / sampling.ts.
const IMPORT_PATTERN = /(?:from|require\()\s*['"][^'"]*\/illuminant['"]/;

export function findIlluminantImport(text) {
  return IMPORT_PATTERN.test(text) ? ['illuminant module imported into a live read file'] : [];
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (EXCLUDE_PATH_PARTS.some((part) => p.includes(part))) return [];
    if (statSync(p).isDirectory()) return walk(p);
    return ['.ts', '.tsx'].includes(extname(p)) ? [p] : [];
  });
}

function scan() {
  const hits = [];
  for (const dir of GUARDED_DIRS) {
    for (const file of walk(dir)) {
      const bad = findIlluminantImport(readFileSync(file, 'utf8'));
      if (bad.length) hits.push(`${file}: ${bad.join(', ')}`);
    }
  }
  if (hits.length) {
    console.error(
      'ILLUMINANT MODULE WIRED INTO LIVE READ PATH -- this reintroduces a measured regression ' +
        '(Task 12/12b, see cv/illuminant.ts header). If this is deliberate, update this script ' +
        "alongside the wiring and confirm the darkSpots/redness illuminant-axis metric first:\n" +
        hits.join('\n'),
    );
    process.exit(1);
  }
  console.log('compliance: illuminant correction remains unwired (retired per Task 12/12b)');
}

if (import.meta.url === `file://${process.argv[1]}`) scan();
