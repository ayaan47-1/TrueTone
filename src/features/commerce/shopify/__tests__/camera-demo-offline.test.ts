// Dwight FAIL on PR #60, round 2: the camera build must never reach Shopify, even when
// production-looking Shopify values leak into its environment.
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROD_LIKE_SHOPIFY_ENV = {
  EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: 'truetone-prodlike.myshopify.com',
  EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: 'prodlike-public-storefront-token',
  EXPO_PUBLIC_SHOPIFY_CHECKOUT_HOSTS: 'truetone-prodlike.myshopify.com',
};
const CHECKOUT_URL = 'https://truetone-prodlike.myshopify.com/cart/c/abc123?_cs=consent&key=k';

type Runtime = typeof import('../runtime');
type Store = typeof import('../shopify-store');
type Client = typeof import('../client');
type Present = typeof import('../present-checkout');

const originalEnv = process.env;
const originalFetch = global.fetch;
let fetchSpy: jest.Mock;

function load(cameraDemo: string) {
  process.env = { ...originalEnv, ...PROD_LIKE_SHOPIFY_ENV, EXPO_PUBLIC_CAMERA_DEMO: cameraDemo };
  let out!: { runtime: Runtime; store: Store; client: Client; present: Present };
  jest.isolateModules(() => {
    out = {
      runtime: require('../runtime'),
      store: require('../shopify-store'),
      client: require('../client'),
      present: require('../present-checkout'),
    };
  });
  return out;
}

beforeEach(async () => {
  fetchSpy = jest.fn().mockRejectedValue(new Error('network-used'));
  global.fetch = fetchSpy as unknown as typeof fetch;
  await AsyncStorage.clear();
});

afterEach(() => {
  process.env = originalEnv;
  global.fetch = originalFetch;
});

test('control: a normal build with the same env calls the Storefront API', async () => {
  const { runtime } = load('');
  await expect(runtime.getShopifyServices().catalog.list()).rejects.toThrow();
  expect(fetchSpy).toHaveBeenCalled();
});

describe('camera build with production-looking Shopify env', () => {
  test('catalog, product and cart calls all fail closed with zero fetch calls', async () => {
    const { runtime } = load('1');
    const services = runtime.getShopifyServices();
    await expect(services.catalog.list()).rejects.toThrow();
    await expect(services.catalog.getByHandle('anything')).rejects.toThrow();
    await expect(services.cart.load()).rejects.toThrow();
    await expect(services.cart.add('gid://shopify/ProductVariant/1', 1)).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('a client built directly still never calls its fetch', async () => {
    const { client } = load('1');
    const fetchImpl = jest.fn();
    const c = client.createShopifyClient(
      { endpoint: 'https://x.myshopify.com/api/graphql.json', storeDomain: 'x.myshopify.com', storefrontToken: 't', checkoutHosts: [] },
      fetchImpl,
    );
    await expect(c.request('{ shop { name } }')).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('a previously cached catalog is not shown (its images would load from Shopify)', async () => {
    const { runtime } = load('1');
    await AsyncStorage.setItem('truetone.shopify.catalog.v2', JSON.stringify({ schemaVersion: 2, products: [], updatedAt: 1 }));
    expect(await runtime.getShopifyServices().catalogCache.read()).toBeNull();
  });

  test('the store ends in an error state with no products and no fetch', async () => {
    const { store } = load('1');
    await store.shopifyStore.loadProducts();
    await store.shopifyStore.loadCart();
    const state = store.shopifyStore.getState();
    expect(state.products).toEqual([]);
    expect(state.cart).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('checkout never opens, so no URL or _cs consent is passed through', async () => {
    const { present } = load('1');
    const presentation = { present: jest.fn(), openBrowser: jest.fn() };
    await expect(
      present.presentCheckout(CHECKOUT_URL, presentation, ['truetone-prodlike.myshopify.com']),
    ).rejects.toThrow();
    expect(presentation.present).not.toHaveBeenCalled();
    expect(presentation.openBrowser).not.toHaveBeenCalled();
  });
});
