// scripts/check-no-image-egress.mjs
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

// Tokens that would mean an image/photo path is leaving the device from the scan pipeline.
const FORBIDDEN = ['.storage', 'upload', 'imageUri', 'photo.path', 'FormData'];
// Directories that must never touch the network with image data.
const GUARDED_DIRS = ['src/features/capture', 'src/features/read'];
// image-lifecycle + preprocess legitimately reference the uri locally; allow file-system + tensor ops.
const ALLOW = ['deleteAsync', 'FileSystem', 'normalizeToTensor', 'readAsStringAsync'];

export function findEgress(text) {
  const cleaned = ALLOW.reduce((s, a) => s.split(a).join(''), text);
  return FORBIDDEN.filter((f) => cleaned.includes(f));
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return ['.ts', '.tsx'].includes(extname(p)) ? [p] : [];
  });
}

function scan() {
  const hits = [];
  for (const dir of GUARDED_DIRS) {
    for (const file of walk(dir)) {
      const bad = findEgress(readFileSync(file, 'utf8'));
      if (bad.length) hits.push(`${file}: ${bad.join(', ')}`);
    }
  }
  if (hits.length) {
    console.error('IMAGE EGRESS detected in scan pipeline:\n' + hits.join('\n'));
    process.exit(1);
  }
  console.log('compliance: no image egress from scan pipeline');
}

if (import.meta.url === `file://${process.argv[1]}`) scan();
