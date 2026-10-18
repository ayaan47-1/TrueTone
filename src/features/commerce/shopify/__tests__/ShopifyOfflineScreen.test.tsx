import { cleanup, render } from '@testing-library/react-native';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import { mapProductNode } from '../product-mapper';

const mockState = {
  products: [mapProductNode(PRODUCT_FIXTURE_NODE)],
  cart: null,
  loadingProducts: false,
  loadingCart: false,
  error: 'The shop is unavailable right now. Please try again.',
  catalogStatus: 'cached' as const,
  catalogUpdatedAt: Date.UTC(2026, 9, 18, 18, 0, 0),
  cartOnline: false,
};

jest.mock('../shop-privacy', () => ({ hasAcceptedShopPrivacy: () => true }));
jest.mock('../shopify-store', () => ({
  useShopifyStore: () => mockState,
  shopifyStore: {
    loadProducts: jest.fn(),
    loadProduct: jest.fn(),
    addToCart: jest.fn(),
  },
}));

import { ShopifyProductScreen } from '../ui/ShopifyProductScreen';
import { ShopifyShopScreen } from '../ui/ShopifyShopScreen';

afterEach(cleanup);

it('labels dated cached products as offline', async () => {
  const view = await render(<ShopifyShopScreen onOpen={jest.fn()} onBag={jest.fn()} onDecline={jest.fn()} />);
  expect(view.getByText(/Offline products · Last updated/)).toBeTruthy();
  expect(view.getByText(/Prices and availability may have changed/)).toBeTruthy();
});

it('disables add-to-bag for a cached product', async () => {
  const view = await render(
    <ShopifyProductScreen handle="yensa-bronzing-drops" onBack={jest.fn()} onAdded={jest.fn()} />,
  );
  expect(view.getByText(/Add to Shopify bag/)).toBeDisabled();
});
