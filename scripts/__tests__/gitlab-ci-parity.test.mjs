import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The repo is mirrored to GitLab, where .github/workflows/* is inert — GitLab CI
// never reads it. Every compliance gate therefore exists twice, and a check added
// to one side but not the other is a gate that silently stops running on a whole
// remote. These tests pin the two together.

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const GH = read('../../.github/workflows/compliance.yml');
const GL = read('../../.gitlab-ci.yml');

// `- run: <cmd>` is the only way the GitHub workflow executes anything.
const githubCommands = [...GH.matchAll(/^\s*-\s*run:\s*(.+?)\s*$/gm)].map((m) => m[1]);

test('the GitHub workflow still declares the commands we are mirroring', () => {
  // Guards the extraction itself: if the workflow is restructured so `- run:`
  // no longer matches, every parity assertion below would pass vacuously.
  assert.ok(githubCommands.length >= 5, `expected >=5 commands, got ${githubCommands.length}`);
  assert.ok(githubCommands.includes('npm ci'));
});

test('every command the GitHub workflow runs also runs on GitLab', () => {
  for (const cmd of githubCommands) {
    assert.ok(GL.includes(cmd), `.gitlab-ci.yml is missing: ${cmd}`);
  }
});

test('both CI configs pin the same Node major version', () => {
  const ghNode = GH.match(/node-version:\s*'?(\d+)/)?.[1];
  const glNode = GL.match(/\bnode:(\d+)/)?.[1];
  assert.ok(ghNode, 'could not read node-version from the GitHub workflow');
  assert.equal(glNode, ghNode);
});

test('GitLab does not run the integration suite', () => {
  // test:integration needs a live Supabase; the GitHub workflow deliberately
  // omits it and CI has no credentials, so it would fail rather than be skipped.
  assert.equal(GL.includes('test:integration'), false);
});

test('GitLab does not run a duplicate pipeline for a branch with an open MR', () => {
  // Without this guard GitLab queues both a branch pipeline and an MR pipeline
  // for every push to a branch under review — each one a full npm ci.
  assert.match(GL, /\$CI_OPEN_MERGE_REQUESTS/);
  assert.match(GL, /when:\s*never/);
});
