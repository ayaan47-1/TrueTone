import { cleanup, render } from '@testing-library/react-native';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import { mapProductNode } from '../product-mapper';

const product = mapProductNode(PRODUCT_FIXTURE_NODE);
const mockState = {
  products: [product],
  cart: null,
  loadingProducts: false,
  loadingCart: false,
  error: null,
  catalogStatus: 'cached' as const,
  catalogUpdatedAt: 1_760_811_600_000,
  liveProductHandles: [product.handle],
  cartOnline: false,
};

jest.mock('../shop-privacy', () => ({ hasAcceptedShopPrivacy: () => true }));
jest.mock('../shopify-store', () => ({
  useShopifyStore: () => mockState,
  shopifyStore: {
    loadProduct: jest.fn(),
    addToCart: jest.fn(),
  },
}));

import { ShopifyProductScreen } from '../ui/ShopifyProductScreen';

afterEach(cleanup);

it('allows a directly refreshed product while the rest of the catalog stays cached', async () => {
  const view = await render(
    <ShopifyProductScreen handle={product.handle} onBack={jest.fn()} onAdded={jest.fn()} />,
  );

  expect(view.getByText(/Add to Shopify bag/)).not.toBeDisabled();
});
