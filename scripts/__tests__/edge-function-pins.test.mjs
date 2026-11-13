// MASVS M4: the payment and chat Edge Functions must not float on a major version of supabase-js
// from a CDN, and each must commit a deno.lock so every deploy resolves the same code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FUNCTIONS = join(import.meta.dirname, '../../supabase/functions');
const PINNED = ['stripe-webhook', 'create-payment-intent', 'routine-chat'];
const EXACT = /^npm:@supabase\/supabase-js@\d+\.\d+\.\d+$/;

for (const name of PINNED) {
  const dir = join(FUNCTIONS, name);

  test(`${name}: supabase-js is imported through an exact npm: pin in deno.json`, () => {
    const config = JSON.parse(readFileSync(join(dir, 'deno.json'), 'utf8'));
    assert.match(config.imports?.['@supabase/supabase-js'] ?? '', EXACT);
    const source = readFileSync(join(dir, 'index.ts'), 'utf8');
    assert.doesNotMatch(source, /esm\.sh\/@supabase\/supabase-js/);
    assert.match(source, /from '@supabase\/supabase-js'/);
  });

  test(`${name}: every remote import names an exact version`, () => {
    const source = readFileSync(join(dir, 'index.ts'), 'utf8');
    const remote = [...source.matchAll(/from '((?:https?|npm):[^']+)'/g)].map((m) => m[1]);
    for (const spec of remote) assert.match(spec, /@\d+\.\d+\.\d+(\/|$)/, `floating import: ${spec}`);
  });

  test(`${name}: a deno.lock is committed and records the pinned supabase-js`, () => {
    const lockPath = join(dir, 'deno.lock');
    assert.ok(existsSync(lockPath), 'deno.lock missing');
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    const pin = JSON.parse(readFileSync(join(dir, 'deno.json'), 'utf8')).imports['@supabase/supabase-js'];
    assert.ok(JSON.stringify(lock).includes(pin.replace(/^npm:/, '')), 'lock does not record the pin');
  });
}
