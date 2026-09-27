// scripts/check-no-medical-claims.mjs
// Founder hard rule: the app NEVER gives medical or allergy advice (compliance.md §3.1).
// Scans user-facing copy + the chat prompt for the shared MEDICAL_CLAIM_BLOCKLIST. A banned phrase
// inside a negation or a see-a-clinician redirect is allowed. If this fires on copy, rewrite the
// copy as a negation or disclaimer — never weaken the list. Run with --experimental-strip-types.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findUnnegatedMedicalClaims } from '../src/content/medical-claims.ts';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
// Every .ts/.tsx file under these dirs is user-facing copy or a copy-bearing screen.
const GUARDED_DIRS = ['src/content', 'src/features/allergens', 'app/setup', 'app/allergens.tsx'];
// Single files: the chat prompt and product cards.
const GUARDED_FILES = ['src/features/recommend/chat/prompt.ts', 'src/features/shop/ProductCard.tsx'];
// Any src/features file whose name contains "copy" (consent-copy.ts, allergen-copy.ts, ...).
const COPY_NAME = /copy[^/]*\.tsx?$/;
// The blocklist itself necessarily contains every phrase.
const EXCLUDE = ['src/content/medical-claims.ts'];

function walk(p) {
  const abs = join(ROOT, p);
  if (!existsSync(abs)) return [];
  if (!statSync(abs).isDirectory()) return ['.ts', '.tsx'].includes(extname(p)) ? [p] : [];
  return readdirSync(abs).flatMap((name) => (name === '__tests__' ? [] : walk(join(p, name))));
}

export function guardedFiles() {
  const copyFiles = walk('src/features').filter((f) => COPY_NAME.test(f));
  const all = [...GUARDED_DIRS.flatMap(walk), ...GUARDED_FILES.flatMap(walk), ...copyFiles];
  return [...new Set(all)].filter((f) => !EXCLUDE.includes(f)).sort();
}

export function findClaimsInSource(text) {
  // Unescape \' in string literals so "won\'t irritate" matches "won't irritate".
  return findUnnegatedMedicalClaims(text.replace(/\\'/g, "'"));
}

function scan() {
  const hits = [];
  for (const file of guardedFiles()) {
    const bad = findClaimsInSource(readFileSync(join(ROOT, file), 'utf8'));
    if (bad.length) hits.push(`${relative('.', join(ROOT, file))}: ${bad.join(', ')}`);
  }
  if (hits.length) {
    console.error('MEDICAL CLAIM detected in user-facing copy:\n' + hits.join('\n'));
    process.exit(1);
  }
  console.log('compliance: no medical or allergy claims in user-facing copy');
}

if (import.meta.url === `file://${process.argv[1]}`) scan();
