import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import { mapProductNode } from '../product-mapper';

const mockLoadProducts = jest.fn();
const mockLoadProduct = jest.fn();
const supplierDescription = 'Clinically proven to boost collagen by 90%.';
const supplierAltText = 'Clinical collagen treatment before and after';
const mappedProduct = mapProductNode({
  ...PRODUCT_FIXTURE_NODE,
  description: supplierDescription,
  featuredImage: { ...PRODUCT_FIXTURE_NODE.featuredImage, altText: supplierAltText },
});
const mockState = {
  products: [mappedProduct],
  cart: null,
  loadingProducts: false,
  loadingCart: false,
  error: null,
  catalogStatus: 'live' as 'live' | 'cached',
  catalogUpdatedAt: null as number | null,
  liveProductHandles: ['yensa-bronzing-drops'] as string[],
  cartOnline: true,
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
  afterEach(cleanup);

  beforeEach(() => {
    jest.clearAllMocks();
    __resetShopDisclosureForTests();
    mockState.catalogStatus = 'live';
    mockState.catalogUpdatedAt = null;
    mockState.liveProductHandles = ['yensa-bronzing-drops'];
  });

  it('waits for the point-of-context disclosure before any Storefront request', async () => {
    const view = await render(
      <ShopifyShopScreen onOpen={jest.fn()} onBag={jest.fn()} onDecline={jest.fn()} />,
    );
    expect(view.getByText('Shop powered by Shopify')).toBeTruthy();
    expect(
      view.getByText(
        'When you enter the Shop, Shopify may receive device and network information, cookie or similar identifiers, pages and products viewed, cart activity, and privacy choices.',
      ),
    ).toBeTruthy();
    expect(
      view.getByText(
        'If you check out, Shopify and the named supplier receive the items you order and the contact, payment, shipping, and return information needed to complete it.',
      ),
    ).toBeTruthy();
    expect(mockLoadProducts).not.toHaveBeenCalled();

    fireEvent.press(view.getByRole('button', { name: 'Continue to shop' }));
    await waitFor(() => expect(mockLoadProducts).toHaveBeenCalledTimes(1));
  });

  it('leaves Shop without accepting or making a Storefront request when the user chooses Not now', async () => {
    const onDecline = jest.fn();
    const view = await render(
      <ShopifyShopScreen onOpen={jest.fn()} onBag={jest.fn()} onDecline={onDecline} />,
    );

    fireEvent.press(view.getByRole('button', { name: 'Not now' }));

    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(mockLoadProducts).not.toHaveBeenCalled();
  });

  it('renders approved fields but never unapproved product copy', async () => {
    const view = await render(
      <ShopifyShopScreen onOpen={jest.fn()} onBag={jest.fn()} onDecline={jest.fn()} />,
    );
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

  it('shows a real variant title on the product detail page', async () => {
    const shop = await render(
      <ShopifyShopScreen onOpen={jest.fn()} onBag={jest.fn()} onDecline={jest.fn()} />,
    );
    fireEvent.press(shop.getByRole('button', { name: 'Continue to shop' }));
    shop.unmount();

    const product = await render(
      <ShopifyProductScreen handle="yensa-bronzing-drops" onBack={jest.fn()} onAdded={jest.fn()} />,
    );

    expect(product.getAllByText('Universal')).toHaveLength(2);
    expect(product.queryByText('Default Title')).toBeNull();
  });

});
