import { useCallback } from 'react';
import { useShopifyCheckoutSheet } from '@shopify/checkout-sheet-kit';
import * as WebBrowser from 'expo-web-browser';
import { readShopifyConfig } from './env';
import { presentCheckout } from './present-checkout';

export function usePresentCheckout(): (checkoutUrl: string) => Promise<'sheet' | 'browser'> {
  const checkoutSheet = useShopifyCheckoutSheet();
  return useCallback(
    (checkoutUrl: string) =>
      presentCheckout(
        checkoutUrl,
        {
          present: (url) => checkoutSheet.present(url),
          openBrowser: async (url) => {
            await WebBrowser.openBrowserAsync(url);
          },
        },
        readShopifyConfig().storeDomain,
      ),
    [checkoutSheet],
  );
}
