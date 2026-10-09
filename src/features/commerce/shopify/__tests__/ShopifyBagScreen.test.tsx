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
const mockRefreshCart = jest.fn().mockResolvedValue(freshCart);
const mockPresent = jest.fn().mockResolvedValue('sheet');

jest.mock('../shop-privacy', () => ({ hasAcceptedShopPrivacy: () => true }));
jest.mock('../shopify-store', () => ({
  useShopifyStore: () => ({ cart: staleCart, loadingCart: false, error: null }),
  shopifyStore: {
    loadCart: jest.fn(),
    refreshCart: () => mockRefreshCart(),
    updateLine: jest.fn(),
  },
}));
jest.mock('../use-present-checkout', () => ({ usePresentCheckout: () => mockPresent }));

import { ShopifyBagScreen } from '../ui/ShopifyBagScreen';

it('re-queries checkoutUrl immediately before presenting checkout', async () => {
  const view = await render(<ShopifyBagScreen onShop={jest.fn()} />);

  fireEvent.press(view.getByRole('button', { name: 'Guest checkout · $24.00' }));

  await waitFor(() => expect(mockRefreshCart).toHaveBeenCalledTimes(1));
  expect(mockPresent).toHaveBeenCalledWith(freshCart.checkoutUrl);
  expect(mockPresent).not.toHaveBeenCalledWith(staleCart.checkoutUrl);
});
