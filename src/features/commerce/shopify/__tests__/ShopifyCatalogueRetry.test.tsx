import { fireEvent, render } from '@testing-library/react-native';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import { mapProductNode } from '../product-mapper';
import type { ShopifyProduct } from '../types';

let mockStatus: 'offline' | 'empty' | 'ready' = 'offline';
let mockProducts: ShopifyProduct[] = [];
let mockApprovedIds: string[] = [];
const mockRefreshCatalogue = jest.fn(async (_force?: boolean) => {});
const mockLoadProducts = jest.fn(async (_force?: boolean) => {});
jest.mock('../../../match/product-catalog', () => ({
  catalogueIsDemo: false,
  useProductCatalogue: () => ({ status: mockStatus, products: mockApprovedIds.map(id => ({ id })), previousProducts: [] }),
  refreshCatalogue: (force?: boolean) => mockRefreshCatalogue(force),
}));
jest.mock('../shop-privacy', () => ({ hasAcceptedShopPrivacy: () => true }));
jest.mock('../shopify-store', () => ({
  useShopifyStore: () => ({ products: mockProducts, cart: null, loadingProducts: false, error: null, catalogStatus: 'live', catalogUpdatedAt: null }),
  shopifyStore: { loadProducts: (force?: boolean) => mockLoadProducts(force) },
}));

import { ShopifyShopScreen } from '../ui/ShopifyShopScreen';

beforeEach(() => {
  mockStatus = 'offline';
  mockProducts = [];
  mockApprovedIds = [];
  mockRefreshCatalogue.mockReset().mockResolvedValue(undefined);
});

test.each(['offline', 'empty'] as const)('Try again refreshes the %s catalogue as well as Shopify', async (status) => {
  mockStatus = status;
  const view = await render(<ShopifyShopScreen onOpen={jest.fn()} onBag={jest.fn()} onDecline={jest.fn()} />);
  mockLoadProducts.mockClear();
  mockRefreshCatalogue.mockClear();
  await fireEvent.press(view.getByText('Try again'));
  expect(mockRefreshCatalogue).toHaveBeenCalledTimes(1);
  expect(mockRefreshCatalogue).toHaveBeenCalledWith(true);
  expect(mockLoadProducts).toHaveBeenCalledWith(true);
  await view.unmount();
});

test('a recovered catalogue makes its approved product available to open after retry', async () => {
  const onOpen = jest.fn();
  const view = await render(<ShopifyShopScreen onOpen={onOpen} onBag={jest.fn()} onDecline={jest.fn()} />);
  const product = mapProductNode(PRODUCT_FIXTURE_NODE);
  mockRefreshCatalogue.mockImplementationOnce(async () => {
    mockStatus = 'ready';
    mockProducts = [product];
    mockApprovedIds = [product.variants[1].id];
  });
  await fireEvent.press(view.getByText('Try again'));
  await view.rerender(<ShopifyShopScreen onOpen={onOpen} onBag={jest.fn()} onDecline={jest.fn()} />);
  expect(view.queryByText('Catalogue unavailable')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: `View ${product.title}` }));
  expect(onOpen).toHaveBeenCalledWith(product.handle);
  await view.unmount();
});
