import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogueRepository, mapCatalogueRow } from '../../src/features/catalog/repository.ts';
import { createCatalogueState } from '../../src/features/catalog/state.ts';
import { availableAlternatives } from '../../src/features/catalog/alternatives.ts';

const row = (id = 1, overrides = {}) => ({
  variant_gid: `gid://shopify/ProductVariant/${id}`, product_gid: 'gid://shopify/Product/1', vendor: 'Brand', shade_name: 'Neutral 5',
  formula_key: 'brand:formula', formula_version: '1', label_id: '00000000-0000-4000-8000-000000000001', price: 30, currency: 'USD',
  depth_band: 5, brand_depth_rank: 55, base_undertone: 'neutral', undertone_modifiers: ['olive'],
  depth_confidence: 'B', undertone_confidence: 'C', rank_confidence: 'B', modifier_confidence: { olive: 'B' },
  finish: null, coverage: null, lab_status: 'unmeasured', lab_l: null, lab_a: null, lab_b: null, ...overrides,
});

test('maps actual variant IDs, preserves base undertone plus olive, and never invents colour/finish', () => {
  const product = mapCatalogueRow(row());
  assert.equal(product.id, 'gid://shopify/ProductVariant/1');
  assert.equal(product.undertone, 'neutral');
  assert.deepEqual(product.catalogue.undertoneModifiers, ['olive']);
  assert.equal(product.finish, 'unknown');
  assert.equal(product.color, undefined);
  assert.equal(product.hasShimmer, null);
  assert.equal(product.catalogue.lab, null);
});

test('draft confidence, unknown undertone, partial Lab and non-USD prices fail closed', () => {
  for (const changes of [{ depth_confidence: 'D' }, { undertone_confidence: 'X' }, { base_undertone: 'unknown' }, { lab_l: 50 }, { currency: 'CAD' }]) {
    assert.throws(() => mapCatalogueRow(row(1, changes)));
  }
});

test('repository reads every sorted page and accepts empty results without a synthetic substitute', async () => {
  const calls = [];
  const repo = createCatalogueRepository(async (from, to) => { calls.push([from,to]); return from === 0 ? [row(1),row(2)] : []; }, 2);
  assert.equal((await repo.list()).length, 2);
  assert.deepEqual(calls, [[0,1],[2,3]]);
  assert.deepEqual(await createCatalogueRepository(async () => []).list(), []);
});

test('state clears stale recommendations on errors; retries recover; concurrent loads coalesce', async () => {
  let calls = 0;
  let fail = false;
  const store = createCatalogueState({ list: async () => { calls++; if (fail) throw new Error('offline'); return [mapCatalogueRow(row())]; } });
  await Promise.all([store.load(),store.load()]);
  assert.equal(calls, 1);
  assert.equal(store.getSnapshot().status, 'ready');
  fail = true;
  await store.load(true);
  assert.equal(store.getSnapshot().status, 'offline');
  assert.deepEqual(store.getSnapshot().products, []);
  fail = false;
  await store.load(true);
  assert.equal(store.getSnapshot().status, 'ready');
});

test('empty and offline modes never invent products and offline mode performs no reads', async () => {
  const empty = createCatalogueState({ list: async () => [] });
  await empty.load();
  assert.equal(empty.getSnapshot().status, 'empty');
  const offline = createCatalogueState({ list: async () => { throw new Error('must not run'); } }, { offline: true });
  await offline.load(true);
  assert.equal(offline.getSnapshot().status, 'offline');
  assert.deepEqual(offline.getSnapshot().products, []);
});

test('stock fallback uses only explicit preferences and the merged same-formula-first ranking', () => {
  const best = mapCatalogueRow(row(1,{finish:'natural',coverage:'medium'}));
  const same = mapCatalogueRow(row(2,{finish:'natural',coverage:'medium'}));
  const cross = mapCatalogueRow(row(3,{formula_key:'other:formula',finish:'natural',coverage:'medium'}));
  assert.deepEqual(availableAlternatives(best,[cross,same],null,1), []);
  assert.deepEqual(availableAlternatives(best,[cross,same],{finish:'natural',coverage:'medium',budget:30,currency:'USD'},1).map(p=>p.id),[same.id,cross.id]);
});

test('unknown stock-fallback attributes do not become fake preferences', () => {
  assert.deepEqual(availableAlternatives(mapCatalogueRow(row()),[mapCatalogueRow(row(2))],{finish:'natural',coverage:'medium',budget:40,currency:'USD'},1),[]);
});
