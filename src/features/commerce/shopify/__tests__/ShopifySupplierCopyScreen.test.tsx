import { cleanup, render } from '@testing-library/react-native';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import { mapProductNode } from '../product-mapper';

const supplierDescription = 'Clinically proven to boost collagen by 90%.';
const supplierAltText = 'Clinical collagen treatment before and after';
const product = mapProductNode({
  ...PRODUCT_FIXTURE_NODE,
  description: supplierDescription,
  featuredImage: { ...PRODUCT_FIXTURE_NODE.featuredImage, altText: supplierAltText },
});
const mockState = {
  products: [product],
  cart: null,
  loadingProducts: false,
  loadingCart: false,
  error: null,
  catalogStatus: 'live' as const,
  catalogUpdatedAt: Date.now(),
  liveProductHandles: [product.handle],
  cartOnline: true,
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

it('keeps supplier description and alt text off the product detail page', async () => {
  const view = await render(
    <ShopifyProductScreen handle={product.handle} onBack={jest.fn()} onAdded={jest.fn()} />,
  );

  expect(view.queryByText(supplierDescription)).toBeNull();
  expect(view.queryByLabelText(supplierAltText)).toBeNull();
  expect(view.getByLabelText('Product photo, YENSA Bronzing Drops')).toBeTruthy();
});
