import { render } from '@testing-library/react-native';

jest.mock('../shop-privacy', () => ({ hasAcceptedShopPrivacy: () => true }));
jest.mock('../shopify-store', () => ({
  useShopifyStore: () => ({
    products: [],
    cart: null,
    loadingProducts: false,
    loadingCart: false,
    error: null,
    catalogStatus: 'live',
    catalogUpdatedAt: Date.now(),
    cartOnline: false,
  }),
  shopifyStore: { loadProducts: jest.fn() },
}));

import { ShopifyShopScreen } from '../ui/ShopifyShopScreen';

it('shows an explicit empty state when Shopify returns no published products', async () => {
  const view = await render(
    <ShopifyShopScreen onOpen={jest.fn()} onBag={jest.fn()} onDecline={jest.fn()} />,
  );
  expect(view.getByText('No products available')).toBeTruthy();
  expect(view.getByText('The Shopify collection is empty right now.')).toBeTruthy();
});
