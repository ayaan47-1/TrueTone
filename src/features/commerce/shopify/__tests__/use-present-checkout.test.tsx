import { renderHook, waitFor } from '@testing-library/react-native';

const listeners: Record<string, (...args: unknown[]) => void> = {};
const removers: Record<string, jest.Mock> = {};
const mockPresent = jest.fn();
const mockOpenBrowser = jest.fn().mockResolvedValue(undefined);
const mockRefreshCart = jest.fn().mockResolvedValue(null);

jest.mock('@shopify/checkout-sheet-kit', () => ({
  useShopifyCheckoutSheet: () => ({
    present: mockPresent,
    addEventListener: (name: string, callback: (...args: unknown[]) => void) => {
      listeners[name] = callback;
      removers[name] = jest.fn();
      return { remove: removers[name] };
    },
  }),
}));

jest.mock('expo-web-browser', () => ({ openBrowserAsync: (...args: unknown[]) => mockOpenBrowser(...args) }));
jest.mock('../env', () => ({
  readShopifyConfig: () => ({
    storeDomain: 'hwqi01-wd.myshopify.com',
    checkoutHosts: ['hwqi01-wd.myshopify.com', 'truetone.skin', 'www.truetone.skin'],
  }),
}));
jest.mock('../shopify-store', () => ({ shopifyStore: { refreshCart: () => mockRefreshCart() } }));

import { usePresentCheckout } from '../use-present-checkout';

describe('usePresentCheckout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(listeners).forEach((key) => delete listeners[key]);
    Object.keys(removers).forEach((key) => delete removers[key]);
  });

  it('uses Checkout Sheet lifecycle events for refresh and browser fallback', async () => {
    const checkoutUrl = 'https://truetone.skin/cart/c/token?key=opaque';
    const { result, unmount } = await renderHook(() => usePresentCheckout());

    await result.current(checkoutUrl);
    expect(mockPresent).toHaveBeenCalledWith(checkoutUrl);
    expect(Object.keys(listeners).sort()).toEqual(['close', 'completed', 'error']);

    listeners.close();
    listeners.completed({});
    expect(mockRefreshCart).toHaveBeenCalledTimes(2);

    listeners.error({ message: 'native failed' });
    await waitFor(() => expect(mockOpenBrowser).toHaveBeenCalledWith(checkoutUrl));

    await unmount();
    expect(removers.close).toHaveBeenCalled();
    expect(removers.completed).toHaveBeenCalled();
    expect(removers.error).toHaveBeenCalled();
  });
});
