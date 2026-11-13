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

const revision=()=>({revision:'1',expires_at:null,server_now:'2026-11-13T00:00:00Z'});
const source=(list)=>({revision:async()=>({revision:'1',ttlMs:60_000}),page:async()=>({products:await list(),nextCursor:null})});

test('repository reads only one visible keyset page plus a sentinel', async () => {
  const calls = [];
  const repo = createCatalogueRepository({readRevision:async()=>revision(),readPage:async (after,limit) => { calls.push([after,limit]); return after===null?[row(1),row(2),row(3)]:[row(3)]; }},2);
  const first=await repo.page(null);
  assert.equal(first.products.length,2);
  assert.equal(first.nextCursor,row(2).variant_gid);
  assert.deepEqual(calls,[[null,3]]);
  const second=await repo.page(first.nextCursor);
  assert.deepEqual(second.products.map(p=>p.id),[row(3).variant_gid]);
  assert.equal(second.nextCursor,null);
});

test('unchanged revisions avoid re-downloading pages; changed revision and expiry invalidate',async()=>{
  let version='1',reads=0,time=0;
  const repo={revision:async()=>({revision:version,ttlMs:500}),page:async()=>{reads++;return {products:[mapCatalogueRow(row())],nextCursor:null};}};
  const store=createCatalogueState(repo,{now:()=>time});
  await store.load();await store.load(true);
  assert.equal(reads,1);
  assert.equal(store.getSnapshot().products.length,1);
  version='2';await store.load(true);assert.equal(reads,2);
  time=501;await store.load(true);assert.equal(reads,3);
});

test('synchronous revision failure remains retryable instead of retaining a resolved pending request',async()=>{
  let fail=true;
  const store=createCatalogueState({revision:()=>{if(fail)throw Error('offline');return Promise.resolve({revision:'1',ttlMs:60_000});},
    page:async()=>({products:[mapCatalogueRow(row())],nextCursor:null})});
  await store.load();assert.equal(store.getSnapshot().status,'offline');
  fail=false;await store.load(true);assert.equal(store.getSnapshot().status,'ready');
});

test('a slow page cannot extend the server freshness deadline by its download time',async()=>{
  let time=0;
  const store=createCatalogueState({revision:async()=>({revision:'1',ttlMs:100}),page:async()=>{
    time+=150;return {products:[mapCatalogueRow(row())],nextCursor:null};
  }},{now:()=>time});
  await store.load();
  assert.equal(store.getSnapshot().status,'offline');
  assert.deepEqual(store.getSnapshot().products,[]);
});

test('next and previous loads keep only the visible page and reset on a changed revision',async()=>{
  let version='1';const calls=[];
  const store=createCatalogueState({revision:async()=>({revision:version,ttlMs:60_000}),page:async after=>{
    calls.push(after);return {products:[mapCatalogueRow(row(after?2:1))],nextCursor:after?null:row(1).variant_gid};
  }});
  await store.load();await store.loadMore();
  assert.deepEqual(store.getSnapshot().products.map(p=>p.id),[row(2).variant_gid]);
  await store.loadPrevious();
  assert.deepEqual(store.getSnapshot().products.map(p=>p.id),[row(1).variant_gid]);
  version='2';await store.load(true);
  assert.deepEqual(store.getSnapshot().products.map(p=>p.id),[row(1).variant_gid]);
  assert.deepEqual(calls,[null,row(1).variant_gid,null,null]);
});

test('state clears stale recommendations on errors; retries recover; concurrent loads coalesce', async () => {
  let calls = 0;
  let fail = false;
  const repo=source(async()=>{calls++;return [mapCatalogueRow(row())];});
  repo.revision=async()=>{if(fail)throw Error('offline');return {revision:'1',ttlMs:60_000};};
  const store = createCatalogueState(repo);
  await Promise.all([store.load(),store.load()]);
  assert.equal(calls, 1);
  assert.equal(store.getSnapshot().status, 'ready');
  fail = true;
  // Revision transport failures must also clear stale recommendation permission.
  const failed=createCatalogueState({revision:async()=>{throw Error('offline');},page:async()=>assert.fail('must not read')});
  await failed.load();assert.equal(failed.getSnapshot().status,'offline');
  await store.load(true);
  assert.equal(store.getSnapshot().status, 'offline');
  assert.deepEqual(store.getSnapshot().products, []);
  fail = false;
  await store.load(true);
  assert.equal(store.getSnapshot().status, 'ready');
});

test('empty and offline modes never invent products and offline mode performs no reads', async () => {
  const empty = createCatalogueState(source(async () => []));
  await empty.load();
  assert.equal(empty.getSnapshot().status, 'empty');
  const offline = createCatalogueState(source(async () => { throw new Error('must not run'); }), { offline: true });
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
