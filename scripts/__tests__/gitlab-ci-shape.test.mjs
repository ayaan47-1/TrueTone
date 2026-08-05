import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Shape-of-the-pipeline tests, separate from parity (which only asks whether the
// two remotes run the same commands). These pin the arrangement that keeps the
// job affordable: jest is ~90% of the runtime, so it must stay behind the cheap
// gates and must be cancellable.

const GL = readFileSync(new URL('../../.gitlab-ci.yml', import.meta.url), 'utf8');

// Splits the file into top-level blocks. Adequate for a file we own and keeps the
// test free of a YAML parser dependency.
function topLevelBlocks(text) {
  const blocks = {};
  let current = null;
  for (const line of text.split('\n')) {
    const key = line.match(/^([A-Za-z_.][\w.-]*):/);
    if (key) {
      current = key[1];
      blocks[current] = [];
    } else if (current) {
      blocks[current].push(line);
    }
  }
  return Object.fromEntries(Object.entries(blocks).map(([k, v]) => [k, v.join('\n')]));
}

const blocks = topLevelBlocks(GL);

test('the config declares the jobs the split depends on', () => {
  // Without this, every assertion below would pass vacuously on a renamed job.
  assert.ok(blocks.guard, 'expected a `guard` job');
  assert.ok(blocks.jest, 'expected a `jest` job');
});

test('the fast gate does not run the jest suite', () => {
  // jest takes ~15 min of a ~17 min job. If it creeps back into `guard`, the
  // fast feedback the split exists to provide is gone.
  assert.equal(blocks.guard.includes('npm test'), false);
});

test('the compliance gates run in the fast job', () => {
  for (const cmd of ['check:compliance', 'check:no-egress', 'test:scripts']) {
    assert.ok(blocks.guard.includes(cmd), `guard should run ${cmd}`);
  }
});

test('jest runs in a later stage so a failed gate skips it entirely', () => {
  const stages = [...GL.matchAll(/^\s{2}-\s*(\w+)\s*$/gm)].map((m) => m[1]);
  const checkIdx = stages.indexOf('check');
  const testIdx = stages.indexOf('test');
  assert.ok(checkIdx !== -1 && testIdx !== -1, `expected check and test stages, got ${stages}`);
  assert.ok(checkIdx < testIdx, 'check must come before test');
  assert.match(blocks.guard, /stage:\s*check/);
  assert.match(blocks.jest, /stage:\s*test/);
});

test('jobs are interruptible so superseded pipelines stop billing', () => {
  // Auto-cancel redundant pipelines is on for the project, but it only cancels
  // *running* jobs when they opt in. Without this a push during a 17-minute jest
  // run pays for both.
  assert.match(GL, /interruptible:\s*true/);
});
