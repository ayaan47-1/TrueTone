import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Three assertions carried over from the retired GitLab mirror's own shape test
// (scripts/__tests__/gitlab-ci-shape.test.mjs, deleted with .gitlab-ci.yml) and
// repointed at the GitHub-side workflow, because these three specific properties
// still have a live subject here — unlike the rest of that file, which compared
// GitLab's own YAML shape against itself or against GitLab-only concepts (stage
// ordering, MR-pipeline rules, Node-major parity with a config that no longer
// exists) and had nothing left to check once .gitlab-ci.yml was gone.

const GH = readFileSync(
  new URL('../../.github/workflows/mirror-docs-to-brain.yml', import.meta.url),
  'utf8',
);

test('the docs mirror never echoes the token value', () => {
  // Naming the secret in a `token:`/`env:` reference is fine — GitHub Actions
  // masks its value automatically in logs. What must never appear is a `run:`
  // step that echoes or otherwise expands it directly.
  assert.equal(/echo[^\n]*secrets\.BRAIN_SYNC_TOKEN/.test(GH), false);
  // And it must still be referenced somewhere, or the assertion above is vacuous.
  assert.match(GH, /secrets\.BRAIN_SYNC_TOKEN/);
});

test('the docs mirror is serialised so two syncs cannot race', () => {
  // concurrency + cancel-in-progress: false is GitHub's equivalent of GitLab's
  // resource_group — without it, two pushes can push conflicting vault commits.
  assert.match(GH, /concurrency:/);
  assert.match(GH, /cancel-in-progress:\s*false/);
});

test('the mirror commit message follows conventional commits', () => {
  assert.match(GH, /sync\(engineering\): mirror app-repo docs/);
});
