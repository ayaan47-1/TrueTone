import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import { mapProductNode } from '../product-mapper';

const mockLoadProducts = jest.fn();
const mockLoadProduct = jest.fn();
const mockState = {
  products: [mapProductNode(PRODUCT_FIXTURE_NODE)],
  cart: null,
  loadingProducts: false,
  loadingCart: false,
  error: null,
};

jest.mock('../shopify-store', () => ({
  useShopifyStore: () => mockState,
  shopifyStore: {
    loadProducts: (...args: unknown[]) => mockLoadProducts(...args),
    loadProduct: (...args: unknown[]) => mockLoadProduct(...args),
  },
}));

import { __resetShopDisclosureForTests, ShopifyShopScreen } from '../ui/ShopifyShopScreen';
import { ShopifyProductScreen } from '../ui/ShopifyProductScreen';

describe('ShopifyShopScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetShopDisclosureForTests();
  });

  it('waits for the point-of-context disclosure before any Storefront request', async () => {
    const view = await render(<ShopifyShopScreen onOpen={jest.fn()} onBag={jest.fn()} />);
    expect(view.getByText('Shop privacy')).toBeTruthy();
    expect(mockLoadProducts).not.toHaveBeenCalled();

    fireEvent.press(view.getByRole('button', { name: 'Continue to shop' }));
    await waitFor(() => expect(mockLoadProducts).toHaveBeenCalledTimes(1));
  });

  it('renders approved fields but never unapproved product copy', async () => {
    const view = await render(<ShopifyShopScreen onOpen={jest.fn()} onBag={jest.fn()} />);
    fireEvent.press(view.getByRole('button', { name: 'Continue to shop' }));
    await waitFor(() => expect(view.getByText('YENSA Bronzing Drops')).toBeTruthy());
    expect(view.queryByText(/radiant|glow|skin-loving/i)).toBeNull();
  });

  it('blocks a direct product deep link before the Shop disclosure', async () => {
    const view = await render(
      <ShopifyProductScreen handle="direct-link" onBack={jest.fn()} onAdded={jest.fn()} />,
    );

    expect(view.getByText('Open Shop first')).toBeTruthy();
    expect(mockLoadProduct).not.toHaveBeenCalled();
  });
});
