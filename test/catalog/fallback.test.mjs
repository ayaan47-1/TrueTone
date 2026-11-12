import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseAvailableShades } from '../../src/features/catalog/fallback.ts';

const candidate = (variantId, overrides = {}) => ({
  variantId, formulaKey: 'formula-a', formulaVersion: '1',
  published: true, inStock: true, deleted: false, approved: true,
  depthBand: 5, baseUndertone: 'neutral', depthConfidence: 'B', undertoneConfidence: 'B',
  finish: 'natural', coverage: 'medium', price: 30, currency: 'USD',
  ...overrides,
});
const preferences = { finish: 'natural', coverage: 'medium', budget: 40, currency: 'USD' };

test('unavailable best match stays in the explanation; same-formula option precedes cross-brand', () => {
  const best = candidate('best', { inStock: false });
  const result = chooseAvailableShades({ best, candidates: [candidate('cross', { formulaKey: 'b' }), candidate('same')], preferences, maxDepthDifference: 1 });
  assert.equal(result.kind, 'alternatives');
  assert.equal(result.unavailableVariantId, 'best');
  assert.deepEqual(result.alternatives.map(row => row.variantId), ['same', 'cross']);
});

test('exact available SKU is preferred', () => {
  assert.deepEqual(chooseAvailableShades({ best: candidate('best'), candidates: [], preferences, maxDepthDifference: 1 }), { kind: 'available', variantId: 'best' });
});

test('never substitutes unapproved, unknown, D/X, unpublished, stale-formula or unsuitable options', () => {
  const best = candidate('best', { inStock: false });
  const candidates = [
    candidate('draft', { approved: false }), candidate('D', { depthConfidence: 'D' }),
    candidate('X', { undertoneConfidence: 'X' }), candidate('unknown', { baseUndertone: 'unknown' }),
    candidate('unpublished', { published: false }), candidate('deleted', { deleted: true }),
    candidate('stock', { inStock: false }), candidate('depth', { depthBand: 8 }),
    candidate('undertone', { baseUndertone: 'warm' }), candidate('price', { price: 41 }),
    candidate('currency', { currency: 'CAD' }), candidate('finish', { finish: 'matte' }),
    candidate('coverage', { coverage: 'full' }), candidate('version', { formulaVersion: '2', approved: false }),
  ];
  assert.deepEqual(chooseAvailableShades({ best, candidates, preferences, maxDepthDifference: 1 }), { kind: 'none', unavailableVariantId: 'best' });
});

test('missing preferences and unknown best evidence do not force alternatives', () => {
  assert.equal(chooseAvailableShades({ best: candidate('best', { inStock: false }), candidates: [candidate('a')], preferences: null, maxDepthDifference: 1 }).kind, 'none');
  assert.equal(chooseAvailableShades({ best: candidate('best', { depthConfidence: 'D' }), candidates: [candidate('a')], preferences, maxDepthDifference: 1 }).kind, 'none');
});

test('within-formula rank cannot make a cross-brand near match; ties are deterministic', () => {
  const result = chooseAvailableShades({ best: candidate('best', { inStock: false, brandDepthRank: 50 }), candidates: [candidate('z', { brandDepthRank: 99 }), candidate('a', { brandDepthRank: 1 })], preferences, maxDepthDifference: 1 });
  assert.deepEqual(result.alternatives.map(row => row.variantId), ['a', 'z']);
});
