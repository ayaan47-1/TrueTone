// scripts/__tests__/check-executorch-unwired.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findExecutorchWiring } from '../check-executorch-unwired.mjs';

test('flags a relative import of the executorch engine', () => {
  assert.deepEqual(
    findExecutorchWiring("import { ExecutorchEngine } from './executorch-engine';"),
    ['executorch engine imported into a live read/app file'],
  );
});
test('flags a require() of the executorch engine', () => {
  assert.deepEqual(
    findExecutorchWiring("const { ExecutorchEngine } = require('../read/executorch-engine');"),
    ['executorch engine imported into a live read/app file'],
  );
});
test('flags direct construction even without a matching import in the same string', () => {
  assert.deepEqual(
    findExecutorchWiring('const engine = new ExecutorchEngine();'),
    ['ExecutorchEngine constructed outside its own module'],
  );
});
test('does not flag an unrelated file with no executorch reference', () => {
  assert.deepEqual(findExecutorchWiring("import { CvReadEngine } from './cv-read-engine';"), []);
});
test('does not flag a plain comment mentioning executorch by name', () => {
  assert.deepEqual(
    findExecutorchWiring('// executorch-engine.ts is the device-only shell.'),
    [],
  );
});
