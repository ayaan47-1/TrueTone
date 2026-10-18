import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ShopifyCart } from '../types';

const staleCart: ShopifyCart = {
  id: 'gid://shopify/Cart/test',
  checkoutUrl: 'https://truetone.skin/cart/c/stale?key=opaque',
  totalQuantity: 1,
  subtotal: { amount: '24.00', currencyCode: 'USD' },
  lines: [{
    id: 'gid://shopify/CartLine/1',
    quantity: 1,
    merchandise: {
      id: 'gid://shopify/ProductVariant/1',
      title: 'Warm 1',
      availableForSale: true,
      quantityAvailable: 5,
      selectedOptions: [],
      price: { amount: '24.00', currencyCode: 'USD' },
      compareAtPrice: null,
      image: null,
      product: { id: 'gid://shopify/Product/1', handle: 'test', title: 'Test product', vendor: 'Supplier' },
    },
  }],
};
const freshCart = { ...staleCart, checkoutUrl: 'https://truetone.skin/cart/c/fresh?key=opaque' };
let mockCart = staleCart;
let mockCartOnline = true;
const mockRefreshCart = jest.fn().mockResolvedValue(freshCart);
const mockPresent = jest.fn().mockResolvedValue('sheet');

jest.mock('../shop-privacy', () => ({ hasAcceptedShopPrivacy: () => true }));
jest.mock('../shopify-store', () => ({
  useShopifyStore: () => ({ cart: mockCart, loadingCart: false, error: null, cartOnline: mockCartOnline }),
  shopifyStore: {
    loadCart: jest.fn(),
    refreshCart: () => mockRefreshCart(),
    updateLine: jest.fn(),
  },
}));
jest.mock('../use-present-checkout', () => ({ usePresentCheckout: () => mockPresent }));

import { ShopifyBagScreen } from '../ui/ShopifyBagScreen';

beforeEach(() => {
  mockCart = staleCart;
  mockCartOnline = true;
  jest.clearAllMocks();
  mockRefreshCart.mockResolvedValue(freshCart);
});

it('shows the bag read-only and disables mutations and checkout offline', async () => {
  mockCartOnline = false;
  const view = await render(<ShopifyBagScreen onShop={jest.fn()} />);

  expect(view.getByText('Bag unavailable offline')).toBeTruthy();
  expect(view.getByText('Increase')).toBeDisabled();
  expect(view.getByText('Guest checkout · $24.00')).toBeDisabled();
});

it('re-queries checkoutUrl immediately before presenting checkout', async () => {
  const view = await render(<ShopifyBagScreen onShop={jest.fn()} />);

  fireEvent.press(view.getByRole('button', { name: 'Guest checkout · $24.00' }));

  await waitFor(() => expect(mockRefreshCart).toHaveBeenCalledTimes(1));
  expect(mockPresent).toHaveBeenCalledWith(freshCart.checkoutUrl);
  expect(mockPresent).not.toHaveBeenCalledWith(staleCart.checkoutUrl);
});

it('shows real variant titles in the bag without showing Shopify Default Title', async () => {
  const view = await render(<ShopifyBagScreen onShop={jest.fn()} />);
  expect(view.getByText('Warm 1')).toBeTruthy();

  mockCart = {
    ...staleCart,
    lines: [{
      ...staleCart.lines[0],
      merchandise: { ...staleCart.lines[0].merchandise, title: '' },
    }],
  };
  const singleVariant = await render(<ShopifyBagScreen onShop={jest.fn()} />);
  expect(singleVariant.queryByText('Default Title')).toBeNull();
});
