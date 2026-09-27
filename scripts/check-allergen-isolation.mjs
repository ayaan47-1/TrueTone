// scripts/check-allergen-isolation.mjs
// Allergen P1 (design §2.2): the user's ingredient flags live only on the phone. Fails the build if
//  (1) any server-bound surface imports the allergen profile/store (Supabase client, the chat
//      client, the Edge Functions, Community, the share card), or
//  (2) any allergen module other than the consent-receipt wrapper touches the network.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const FORBIDDEN_IMPORTERS = [
  'src/lib/supabase.ts', 'src/lib/routine-chat.ts', 'supabase/functions',
  'src/features/community', 'src/features/shade/ScanShareCard.tsx',
];
// Any module under src/features/allergens holds or handles the profile.
const ALLERGEN_IMPORT = /(?:from\s+|require\()\s*['"][^'"]*features\/allergens\/[^'"]*['"]|(?:from\s+|require\()\s*['"][^'"]*\/(?:allergen-store|use-allergen-profile)['"]/;
const ALLERGEN_DIR = 'src/features/allergens';
// Sends only a no-argument consent receipt (migration 0022), never the flags.
const NETWORK_ALLOWED = ['src/features/allergens/health-consent.ts'];
const NETWORK = [['supabase', /lib\/supabase['"]/], ['fetch(', /\bfetch\(/], ['XMLHttpRequest', /XMLHttpRequest/], ['axios', /['"]axios['"]/]];

function walk(p) {
  const abs = join(ROOT, p);
  if (!existsSync(abs)) return [];
  if (!statSync(abs).isDirectory()) return ['.ts', '.tsx'].includes(extname(p)) ? [p] : [];
  return readdirSync(abs).flatMap((name) => (name === '__tests__' ? [] : walk(join(p, name))));
}

export function importsAllergenData(text) {
  return ALLERGEN_IMPORT.test(text);
}

export function allergenNetworkUse(file, text) {
  if (NETWORK_ALLOWED.includes(file)) return [];
  return NETWORK.filter(([, re]) => re.test(text)).map(([name]) => name);
}

export function scanIsolation() {
  const read = (f) => readFileSync(join(ROOT, f), 'utf8');
  const leaks = FORBIDDEN_IMPORTERS.flatMap(walk)
    .filter((f) => importsAllergenData(read(f)))
    .map((f) => `${f}: imports the on-device allergen profile`);
  const network = walk(ALLERGEN_DIR).flatMap((f) => {
    const hits = allergenNetworkUse(f, read(f));
    return hits.length ? [`${f}: network use (${hits.join(', ')})`] : [];
  });
  return [...leaks, ...network];
}

function main() {
  const hits = scanIsolation();
  if (hits.length) {
    console.error('ALLERGEN DATA ISOLATION broken:\n' + hits.join('\n'));
    process.exit(1);
  }
  console.log('compliance: allergen profile stays on-device');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
