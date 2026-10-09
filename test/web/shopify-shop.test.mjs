import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CART_ID_KEY,
  CART_CREATE,
  CART_QUERY,
  PRODUCTS_QUERY,
  PRODUCT_BY_HANDLE_QUERY,
  ShopifyRequestError,
  createCartApi,
  createStorefrontClient,
  isAllowedCheckoutUrl,
  mapProduct,
  readShopifyConfig,
} from '../../web/shop/storefront.js';
import { STOREFRONT_FIXTURE } from '../../web/shop/fixtures.js';

const config = {
  storeDomain: 'hwqi01-wd.myshopify.com',
  storefrontToken: 'public-token',
  checkoutHosts: ['hwqi01-wd.myshopify.com', 'checkout.truetone.example'],
};

test('uses the same pinned Storefront contract and default-deny visitor consent as the app', () => {
  for (const query of [PRODUCTS_QUERY, PRODUCT_BY_HANDLE_QUERY, CART_QUERY, CART_CREATE]) {
    assert.match(query, /analytics: false/);
    assert.match(query, /preferences: false/);
    assert.match(query, /marketing: false/);
    assert.match(query, /saleOfData: false/);
  }
  assert.doesNotMatch(PRODUCTS_QUERY + PRODUCT_BY_HANDLE_QUERY, /description/i);
});

test('reads validated build config without accepting a hard-coded alternate endpoint', () => {
  const parsed = readShopifyConfig(config);
  assert.equal(parsed.endpoint, 'https://hwqi01-wd.myshopify.com/api/2026-10/graphql.json');
  assert.deepEqual(parsed.checkoutHosts, config.checkoutHosts);
  assert.throws(() => readShopifyConfig({ ...config, storeDomain: 'evil.example' }), /myshopify/i);
});

test('Storefront client sends only GraphQL and public token fields', async () => {
  const calls = [];
  const client = createStorefrontClient(config, async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ data: STOREFRONT_FIXTURE.products }) };
  });
  await client.request(PRODUCTS_QUERY, { first: 24 });
  assert.equal(calls[0].url, 'https://hwqi01-wd.myshopify.com/api/2026-10/graphql.json');
  assert.deepEqual(calls[0].options.headers, {
    'Content-Type': 'application/json',
    'X-Shopify-Storefront-Access-Token': 'public-token',
  });
  assert.doesNotMatch(JSON.stringify(calls), /scan|score|shade|profile|routine|chat/i);
});

test('Storefront client distinguishes GraphQL, network, and HTTP failures', async () => {
  const graphql = createStorefrontClient(config, async () => ({
    ok: true, json: async () => ({ errors: [{ message: 'Invalid cart' }] }),
  }));
  await assert.rejects(graphql.request(CART_QUERY, { id: 'opaque' }), (error) => {
    assert.equal(error.kind, 'graphql');
    return true;
  });

  const network = createStorefrontClient(config, async () => { throw new Error('offline'); });
  await assert.rejects(network.request(PRODUCTS_QUERY, { first: 24 }), (error) => {
    assert.equal(error.kind, 'network');
    return true;
  });

  const server = createStorefrontClient(config, async () => ({ ok: false, status: 503 }));
  await assert.rejects(server.request(PRODUCTS_QUERY, { first: 24 }), (error) => {
    assert.deepEqual({ kind: error.kind, status: error.status }, { kind: 'http', status: 503 });
    return true;
  });
});

test('maps reviewed product identity fields and allows only exact Shopify CDN media', () => {
  const product = mapProduct(STOREFRONT_FIXTURE.products.products.nodes[0]);
  assert.equal(product.description, null);
  assert.equal(product.image.url, 'https://cdn.shopify.com/s/files/test/lip-color.webp');
  assert.equal(mapProduct({
    ...STOREFRONT_FIXTURE.products.products.nodes[0],
    featuredImage: { url: 'https://supplier.example/hotlink.jpg', altText: 'unreviewed' },
  }).image, null);
});

test('cart persists only the opaque ID and preserves it on network or 5xx errors', async () => {
  const values = new Map([[CART_ID_KEY, 'gid://shopify/Cart/current']]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  for (const error of [
    new ShopifyRequestError('offline', 'network'),
    new ShopifyRequestError('unavailable', 'http', 503),
  ]) {
    const cart = createCartApi({ request: async () => { throw error; } }, storage);
    await assert.rejects(cart.load(), error);
    assert.equal(values.get(CART_ID_KEY), 'gid://shopify/Cart/current');
    assert.deepEqual([...values.keys()], [CART_ID_KEY]);
  }
});

test('cart drops an invalid GraphQL ID and recreates from the recorded fixture', async () => {
  const values = new Map([[CART_ID_KEY, 'gid://shopify/Cart/stale']]);
  let requestCount = 0;
  const client = {
    async request() {
      requestCount += 1;
      if (requestCount === 1) throw new ShopifyRequestError('Invalid global id', 'graphql');
      return STOREFRONT_FIXTURE.cartCreate;
    },
  };
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const result = await createCartApi(client, storage).load();
  assert.equal(result.id, 'gid://shopify/Cart/new');
  assert.equal(values.get(CART_ID_KEY), result.id);
  assert.equal(requestCount, 2);
});

test('checkout accepts only HTTPS, an exact configured host, and Shopify checkout paths', () => {
  assert.equal(isAllowedCheckoutUrl('https://hwqi01-wd.myshopify.com/cart/c/token?_cs=opaque', config.checkoutHosts), true);
  assert.equal(isAllowedCheckoutUrl('https://checkout.truetone.example/checkouts/token?key=opaque', config.checkoutHosts), true);
  assert.equal(isAllowedCheckoutUrl('https://hwqi01-wd.myshopify.com.evil.example/cart/c/token', config.checkoutHosts), false);
  assert.equal(isAllowedCheckoutUrl('https://hwqi01-wd.myshopify.com/cart/c/token/extra', config.checkoutHosts), false);
  assert.equal(isAllowedCheckoutUrl('https://hwqi01-wd.myshopify.com/products/token', config.checkoutHosts), false);
  assert.equal(isAllowedCheckoutUrl('http://hwqi01-wd.myshopify.com/cart/c/token', config.checkoutHosts), false);
});

test('static Shop pages provide the disclosure gate, collection, PDP, cart, and persistent privacy controls', () => {
  const pages = ['index.html', 'product.html', 'cart.html'].map((name) =>
    readFileSync(new URL(`../../web/shop/${name}`, import.meta.url), 'utf8'),
  );
  for (const html of pages) {
    assert.match(html, /Shop powered by Shopify/);
    assert.match(html, />Not now</);
    assert.match(html, /Privacy choices/);
    assert.match(html, /Do not sell or share/);
    assert.match(html, /\/shop\/shop\.js/);
    assert.doesNotMatch(html, /https?:\/\/(?!www\.shopify\.com\/legal\/privacy\/consumers)/);
  }
  assert.match(pages[0], /data-product-grid/);
  assert.match(pages[1], /data-variant-picker/);
  assert.match(pages[2], /data-cart-lines/);
});

test('Shop controller requests nothing until the disclosure continue action resolves', () => {
  const source = readFileSync(new URL('../../web/shop/shop.js', import.meta.url), 'utf8');
  assert.match(source, /await requireShopEntry\(\);[\s\S]*const client = createStorefrontClient\(/);
  assert.doesNotMatch(source, /analytics|pixel|track\s*\(/i);
});
