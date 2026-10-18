const mockList = jest.fn().mockRejectedValue(new Error('GraphQL schema detail must stay private'));
const mockCacheRead = jest.fn();
const mockCacheWrite = jest.fn();

jest.mock('../runtime', () => ({
  getShopifyServices: () => ({
    catalog: { list: mockList },
    catalogCache: { read: mockCacheRead, write: mockCacheWrite },
    cart: {},
  }),
}));

import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import { mapProductNode } from '../product-mapper';
import { __resetShopifyStoreForTests, shopifyStore } from '../shopify-store';

beforeEach(() => {
  jest.clearAllMocks();
  __resetShopifyStoreForTests();
  mockCacheRead.mockResolvedValue(null);
  mockCacheWrite.mockResolvedValue(undefined);
  mockList.mockRejectedValue(new Error('GraphQL schema detail must stay private'));
});

it('shows a fixed user-safe message instead of a raw Shopify error', async () => {
  await shopifyStore.loadProducts();

  expect(shopifyStore.getState().error).toBe('The shop is unavailable right now. Please try again.');
  expect(shopifyStore.getState().error).not.toContain('GraphQL');
});

it('shows a dated cached catalog when the live request fails', async () => {
  const products = [mapProductNode(PRODUCT_FIXTURE_NODE)];
  mockCacheRead.mockResolvedValue({ products, updatedAt: 1_760_811_600_000 });

  await shopifyStore.loadProducts();

  expect(shopifyStore.getState()).toMatchObject({
    products,
    catalogStatus: 'cached',
    catalogUpdatedAt: 1_760_811_600_000,
  });
  expect(mockCacheWrite).not.toHaveBeenCalled();
});

it('replaces a cached catalog with live products and refreshes the snapshot', async () => {
  const cached = [mapProductNode(PRODUCT_FIXTURE_NODE)];
  const live = [{ ...cached[0], id: 'gid://shopify/Product/live', title: 'Live product' }];
  mockCacheRead.mockResolvedValue({ products: cached, updatedAt: 1_760_811_600_000 });
  mockList.mockResolvedValue(live);

  await shopifyStore.loadProducts();

  expect(shopifyStore.getState()).toMatchObject({ products: live, catalogStatus: 'live' });
  expect(mockCacheWrite).toHaveBeenCalledWith({ products: live, updatedAt: expect.any(Number) });
});
