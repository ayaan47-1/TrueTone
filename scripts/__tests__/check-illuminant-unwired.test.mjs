// scripts/__tests__/check-illuminant-unwired.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findIlluminantImport } from '../check-illuminant-unwired.mjs';

test('flags a relative import of the illuminant module', () => {
  assert.deepEqual(
    findIlluminantImport("import { normalizeIlluminant } from './illuminant';"),
    ['illuminant module imported into a live read file'],
  );
});
test('flags a require() of the illuminant module', () => {
  assert.deepEqual(
    findIlluminantImport("const { adaptToD65 } = require('../cv/illuminant');"),
    ['illuminant module imported into a live read file'],
  );
});
test('does not flag illuminant-axis measurement comments (the common false-positive)', () => {
  assert.deepEqual(
    findIlluminantImport(
      '// Measured: sum-of-channels gives an illuminant-axis redness spread of ~0.074',
    ),
    [],
  );
});
test('does not flag an unrelated import ending in a similar word', () => {
  assert.deepEqual(
    findIlluminantImport("import { x } from './illuminant-notes';"),
    [],
  );
});
