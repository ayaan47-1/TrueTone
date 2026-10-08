import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readPolicyEntries, renderPolicyBodies } from '../../scripts/sync-policy-bodies.mjs';

test('bundled app policy bodies exactly match the Markdown sources', () => {
  assert.equal(
    readFileSync('src/content/bodies.ts', 'utf8'),
    renderPolicyBodies(readPolicyEntries()),
  );
});
