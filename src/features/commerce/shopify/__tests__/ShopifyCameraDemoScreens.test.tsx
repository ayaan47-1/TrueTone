// Camera build: every Shopify screen shows local-only UI and never touches the store or Shopify.
import { cleanup, render } from '@testing-library/react-native';

jest.mock('../../../../lib/supabase', () => ({ SUPABASE_OFFLINE: true, supabase: {} }));
jest.mock('../shop-privacy', () => ({ hasAcceptedShopPrivacy: () => true, acceptShopPrivacy: jest.fn() }));
const mockStore = {
  loadProducts: jest.fn(),
  loadProduct: jest.fn(),
  loadCart: jest.fn(),
  refreshCart: jest.fn(),
  addToCart: jest.fn(),
  updateLine: jest.fn(),
};
jest.mock('../shopify-store', () => ({
  useShopifyStore: () => {
    throw new Error('store must not be read in the camera build');
  },
  shopifyStore: mockStore,
}));
jest.mock('../use-present-checkout', () => ({
  usePresentCheckout: () => {
    throw new Error('checkout sheet must not be set up in the camera build');
  },
}));

import { ShopifyBagScreen } from '../ui/ShopifyBagScreen';
import { ShopifyProductScreen } from '../ui/ShopifyProductScreen';
import { ShopifyShopScreen } from '../ui/ShopifyShopScreen';

const originalFetch = global.fetch;
const fetchSpy = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchSpy as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

function expectNothingRemote(): void {
  Object.values(mockStore).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  expect(fetchSpy).not.toHaveBeenCalled();
}

test('shop screen is local-only', async () => {
  const view = await render(<ShopifyShopScreen onOpen={jest.fn()} onBag={jest.fn()} onDecline={jest.fn()} />);
  expect(view.getByText('The shop is off in this test build')).toBeTruthy();
  expect(JSON.stringify(view.toJSON())).not.toMatch(/"uri"|shopify\.com/);
  expectNothingRemote();
});

test('product screen is local-only', async () => {
  const view = await render(<ShopifyProductScreen handle="any" onBack={jest.fn()} onAdded={jest.fn()} />);
  expect(view.getByText('The shop is off in this test build')).toBeTruthy();
  expectNothingRemote();
});

test('bag screen is local-only and has no checkout', async () => {
  const view = await render(<ShopifyBagScreen onShop={jest.fn()} />);
  expect(view.getByText('The shop is off in this test build')).toBeTruthy();
  expect(view.queryByText(/checkout ·/i)).toBeNull();
  expectNothingRemote();
});
