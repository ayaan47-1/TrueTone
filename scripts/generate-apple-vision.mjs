import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../packages/apple-vision/', import.meta.url));
execFileSync(fileURLToPath(new URL('../node_modules/.bin/nitrogen', import.meta.url)), [], { cwd: root, stdio: 'inherit' });
// Nitrogen emits whitespace-only lines. Normalize formatting reproducibly, not by hand.
function format(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = dir + '/' + entry.name;
    if (entry.isDirectory()) format(file);
    else {
      const source = readFileSync(file, 'utf8');
      const formatted = source.replace(/[\t ]+$/gm, '');
      if (source !== formatted) writeFileSync(file, formatted);
    }
  }
}
format(root + 'nitrogen/generated');
