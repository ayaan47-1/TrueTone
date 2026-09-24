// scripts/check-executorch-unwired.mjs
//
// `ExecutorchEngine` (`src/features/read/executorch-engine.ts`) is a device-only shell for a
// FUTURE trained on-device model, per the approved (but dataset-gated) design in
// `docs/superpowers/specs/2026-07-02-trained-model-track-design.md`. Today it is dead code, not
// a live fallback: `react-native-executorch` is not in package.json, `assets/stub-model.pte`
// does not exist anywhere in the repo, and its own `decodeToRgb` unconditionally throws. The
// live read pipeline (`run-read.ts`) always uses `CvReadEngine`.
//
// This guard makes "not wired" a checked fact rather than something only true because nobody
// has imported it yet. If a future change starts wiring the real trained-model track in
// (per the cutover checklist in the design doc above), that is a deliberate, reviewed step --
// not something that should happen by accident of one new import line. When that day comes,
// update this script's allowlist alongside the wiring, once the package is actually installed
// and a real .pte asset exists (never before).
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

// The only place a real engine swap could happen: the read pipeline and the screens that call it.
const GUARDED_DIRS = ['src/features', 'app'];
const OWN_FILE = join('read', 'executorch-engine.ts');
const EXCLUDE_PATH_PARTS = ['__tests__', OWN_FILE];
const IMPORT_PATTERN = /(?:from|require\()\s*['"][^'"]*\/executorch-engine['"]/;
const CONSTRUCT_PATTERN = /\bnew\s+ExecutorchEngine\s*\(/;

export function findExecutorchWiring(text) {
  const hits = [];
  if (IMPORT_PATTERN.test(text)) hits.push('executorch engine imported into a live read/app file');
  if (CONSTRUCT_PATTERN.test(text)) hits.push('ExecutorchEngine constructed outside its own module');
  return hits;
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
      const bad = findExecutorchWiring(readFileSync(file, 'utf8'));
      if (bad.length) hits.push(`${file}: ${bad.join(', ')}`);
    }
  }
  if (hits.length) {
    console.error(
      'EXECUTORCH ENGINE WIRED INTO A LIVE FILE -- react-native-executorch is not installed and ' +
        'no .pte model asset exists in this repo, so this cannot be a real model today. If this ' +
        'is the deliberate cutover (design doc §6 checklist), update this script alongside it:\n' +
        hits.join('\n'),
    );
    process.exit(1);
  }
  console.log('compliance: executorch model track remains unwired (dataset-gated, not yet started)');
}

if (import.meta.url === `file://${process.argv[1]}`) scan();
