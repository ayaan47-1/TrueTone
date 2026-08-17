import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// The default `npm test` run must stay a *unit* run. Measured on main
// (2026-08-07): the four suites under eval/ took 518s of the suite's 596s — 87%
// — while all 131 other suites finished in 78s combined. eval/ runs the fairness
// invariance axes over real evaluation data and writes reports; it is a
// benchmark, not a unit test, and it is what made the GitLab job ~20 minutes.
//
// eval/ is therefore excluded from the default run and given its own script,
// exactly as test/integration/ already is.

const require = createRequire(import.meta.url);
const jestConfig = require('../../jest.config.js');
const pkg = require('../../package.json');

test('the default jest run excludes the eval harness', () => {
  const ignored = jestConfig.testPathIgnorePatterns ?? [];
  assert.ok(
    ignored.some((p) => /eval/.test(p)),
    `testPathIgnorePatterns must exclude eval/, got ${JSON.stringify(ignored)}`,
  );
});

test('the integration exclusion is still there', () => {
  // Guards against a careless rewrite of the array dropping the original entry.
  const ignored = jestConfig.testPathIgnorePatterns ?? [];
  assert.ok(ignored.some((p) => /test\/integration/.test(p)));
});

test('the eval harness still has a way to run', () => {
  // Excluding it from the default run must not make it unrunnable — that would
  // silently drop the fairness gate rather than move it.
  assert.ok(pkg.scripts['test:eval'], 'package.json needs a test:eval script');
  assert.match(pkg.scripts['test:eval'], /eval/);
});

test('the default test script does not also run eval', () => {
  // If `test` were changed to chain both, the split would be undone without any
  // of the assertions above failing.
  assert.equal(pkg.scripts.test.includes('test:eval'), false);
  assert.equal(pkg.scripts.test.includes('eval/'), false);
});
