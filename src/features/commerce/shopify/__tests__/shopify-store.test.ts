const mockList = jest.fn().mockRejectedValue(new Error('GraphQL schema detail must stay private'));

jest.mock('../runtime', () => ({
  getShopifyServices: () => ({
    catalog: { list: mockList },
    cart: {},
  }),
}));

import { shopifyStore } from '../shopify-store';

it('shows a fixed user-safe message instead of a raw Shopify error', async () => {
  await shopifyStore.loadProducts();

  expect(shopifyStore.getState().error).toBe('The shop is unavailable right now. Please try again.');
  expect(shopifyStore.getState().error).not.toContain('GraphQL');
});
