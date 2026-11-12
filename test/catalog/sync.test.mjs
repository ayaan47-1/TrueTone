import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createWebhookHandler, createReconcileHandler, reconcileCatalogue } from '../../supabase/functions/_shared/catalog/sync.ts';
import { ShopifyCatalogue } from '../../supabase/functions/_shared/catalog/shopify.ts';

const product = { product_gid: 'gid://shopify/Product/1', variants: [] };
function fixture() {
  const calls = [];
  const completed = new Set();
  const store = {
    claim: async id => completed.has(id) ? 'done' : 'claimed',
    complete: async id => { completed.add(id); calls.push(['complete', id]); },
    fail: async id => { calls.push(['fail', id]); },
    applyProduct: async row => { calls.push(['product', row]); },
    deleteProduct: async id => { calls.push(['delete', id]); },
    applyInventory: async row => { calls.push(['inventory', row]); },
    beginReconcile: async () => {},
    failReconcile: async () => {},
    finishReconcile: async (ids, started) => { calls.push(['reconcile', ids, started]); },
  };
  const shopify = { product: async () => product, inventory: async () => ({ inventory_item_gid: 'i1', levels: [] }), products: async function* () { yield product; } };
  const handler = createWebhookHandler({ secret: 'synthetic-secret', shop: 'test.myshopify.com', store, shopify });
  return { handler, store, shopify, calls };
}
function request(body = '{"id":1}', options = {}) {
  return new Request('https://local.test/webhook', { method: 'POST', body,
    headers: { 'x-shopify-shop-domain': 'test.myshopify.com', 'x-shopify-topic': 'products/update',
      'x-shopify-webhook-id': 'event-1',
      'x-shopify-hmac-sha256': createHmac('sha256', 'synthetic-secret').update(body).digest('base64'), ...options } });
}

test('HMAC is checked over raw bytes before parsing; wrong store rejected', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(request('{"id":1}', { 'x-shopify-hmac-sha256': 'bad' }))).status, 401);
  assert.equal((await handler(request('{"id":1}', { 'x-shopify-shop-domain': 'else.myshopify.com' }))).status, 401);
  assert.deepEqual(calls, []);
});

test('webhook fetches authoritative product once, completes only after save, deduplicates', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(request())).status, 200);
  assert.equal((await handler(request())).status, 200);
  assert.deepEqual(calls.map(row => row[0]), ['product', 'complete']);
});

test('fetch/save failure is retriable and never acknowledged as completed', async () => {
  const { handler, store, calls } = fixture();
  store.applyProduct = async () => { throw new Error('synthetic failure'); };
  assert.equal((await handler(request())).status, 503);
  assert.deepEqual(calls, [['fail', 'event-1']]);
});

test('a busy lease returns retryable status instead of acknowledging unfinished work', async () => {
  const { handler, store } = fixture();
  store.claim = async () => 'busy';
  assert.equal((await handler(request())).status, 503);
});

test('reconcile endpoint requires its dedicated bearer token and rejects browser callers', async () => {
  const { store, shopify } = fixture();
  const handler = createReconcileHandler({ secret: 'job-secret', store, shopify });
  assert.equal((await handler(new Request('https://local.test/job', { method: 'POST' }))).status, 401);
  assert.equal((await handler(new Request('https://local.test/job', { method: 'POST', headers: { authorization: 'Bearer job-secret' } }))).status, 200);
});

test('delete tombstones identity; inventory payload is not trusted for stock', async () => {
  const { handler, calls, shopify } = fixture();
  shopify.product = async () => null;
  await handler(request('{"id":1}', { 'x-shopify-topic': 'products/delete' }));
  await handler(request('{"inventory_item_id":7,"available":999}', { 'x-shopify-topic': 'inventory_levels/update', 'x-shopify-webhook-id': 'event-2' }));
  assert.deepEqual(calls[0], ['delete', 'gid://shopify/Product/1']);
  assert.deepEqual(calls[2], ['inventory', { inventory_item_gid: 'i1', levels: [] }]);
});

test('a delayed delete re-fetches current state and cannot remove an existing product', async () => {
  const { handler, calls } = fixture();
  await handler(request('{"id":1}', { 'x-shopify-topic': 'products/delete' }));
  assert.equal(calls[0][0], 'product');
});

test('malformed, unsafe numeric IDs, unsupported topics and oversized bodies fail closed', async () => {
  const { handler } = fixture();
  assert.equal((await handler(request('not-json'))).status, 400);
  assert.equal((await handler(request('{"id":9007199254740993}'))).status, 400);
  assert.equal((await handler(request('{}', { 'x-shopify-topic': 'orders/create' }))).status, 400);
  assert.equal((await handler(request('x'.repeat(2_000_001)))).status, 413);
});

test('complete reconciliation marks missing only after every page succeeds', async () => {
  const { store, shopify, calls } = fixture();
  await reconcileCatalogue({ store, shopify });
  assert.deepEqual(calls.map(row => row[0]), ['product', 'reconcile']);
  assert.deepEqual(calls[1][1], [product.product_gid]);
  calls.length = 0;
  shopify.products = async function* () { yield product; throw new Error('page failed'); };
  await assert.rejects(reconcileCatalogue({ store, shopify }));
  assert.deepEqual(calls.map(row => row[0]), ['product']);
});

test('reconciliation records both successful start and failed traversal without deleting missing rows', async () => {
  const { store, shopify, calls } = fixture();
  store.beginReconcile = async () => calls.push(['begin']);
  store.failReconcile = async () => calls.push(['failed']);
  shopify.products = async function* () { throw new Error('synthetic failure'); };
  await assert.rejects(reconcileCatalogue({ store, shopify }));
  assert.deepEqual(calls.map(row => row[0]), ['begin', 'failed']);
});

test('Shopify adapter rejects GraphQL errors instead of treating them as an empty catalogue', async () => {
  const client = new ShopifyCatalogue({ shop: 'test.myshopify.com', accessToken: 'fake', publicationId: 'gid://shopify/Publication/1', onlineLocationIds: ['gid://shopify/Location/1'], fetcher: async () => Response.json({ errors: [{ message: 'denied' }] }) });
  await assert.rejects(client.product('gid://shopify/Product/1'), /Shopify/);
});

const page = { hasNextPage: false, endCursor: null };
const item = { id: 'gid://shopify/InventoryItem/1', inventoryLevels: { nodes: [{ location: { id: 'gid://shopify/Location/1' }, quantities: [{ name: 'available', quantity: 3 }] }], pageInfo: page } };
const variant = { id: 'gid://shopify/ProductVariant/1', title: 'Neutral 5', sku: 'sku1', barcode: null, price: '30.00', inventoryItem: item };
const shopProduct = { id: 'gid://shopify/Product/1', title: 'Formula', vendor: 'Brand', status: 'ACTIVE', publishedOnPublication: true, formula: null, variants: { nodes: [variant], pageInfo: page } };
function client(fetcher) { return new ShopifyCatalogue({ shop: 'test.myshopify.com', accessToken: 'fake', publicationId: 'gid://shopify/Publication/1', onlineLocationIds: ['gid://shopify/Location/1'], fetcher }); }

test('adapter keeps only product attributes, uses stable formula identity and all pages', async () => {
  let count = 0;
  const adapter = client(async () => {
    count++;
    const current = count === 1 ? { ...shopProduct, variants: { nodes: [variant], pageInfo: { hasNextPage: true, endCursor: 'next' } } }
      : { ...shopProduct, variants: { nodes: [{ ...variant, id: 'gid://shopify/ProductVariant/2', inventoryItem: { ...item, id: 'gid://shopify/InventoryItem/2' } }], pageInfo: page } };
    return Response.json({ data: { product: { ...current, face_image: 'must not persist' }, shop: { currencyCode: 'USD' } } });
  });
  const result = await adapter.product(shopProduct.id);
  assert.equal(result.variants.length, 2);
  assert.equal(result.variants[0].formula_key, 'brand:formula');
  assert.equal(result.variants[0].levels[0].available, 3);
  assert.equal(JSON.stringify(result).includes('face_image'), false);
});

test('nested GraphQL connections use bounded pages instead of a 100-by-100 cost explosion', async () => {
  const adapter = client(async (_url, request) => {
    const { query } = JSON.parse(request.body);
    assert.match(query, /variants\(first:20,/);
    assert.match(query, /inventoryLevels\(first:20,/);
    return Response.json({ data: { product: shopProduct, shop: { currencyCode: 'USD' } } });
  });
  await adapter.product(shopProduct.id);
});

test('non-advancing variant pagination fails instead of truncating', async () => {
  const adapter = client(async () => Response.json({ data: { product: { ...shopProduct, variants: { nodes: [variant], pageInfo: { hasNextPage: true, endCursor: 'same' } } }, shop: { currencyCode: 'USD' } } }));
  await assert.rejects(adapter.product(shopProduct.id), /pagination/);
});

test('a missing available quantity is not silently interpreted as zero', async () => {
  const adapter = client(async () => Response.json({ data: { inventoryItem: { ...item, inventoryLevels: { nodes: [{ ...item.inventoryLevels.nodes[0], quantities: [] }], pageInfo: page } } } }));
  await assert.rejects(adapter.inventory(item.id), /quantity/);
});
