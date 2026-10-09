import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useShopifyCheckoutSheet } from '@shopify/checkout-sheet-kit';
import * as WebBrowser from 'expo-web-browser';
import { readShopifyConfig } from './env';
import { presentCheckout } from './present-checkout';
import { shopifyStore } from './shopify-store';

export function usePresentCheckout(): (checkoutUrl: string) => Promise<'sheet' | 'browser'> {
  const checkoutSheet = useShopifyCheckoutSheet();
  const latestCheckoutUrl = useRef<string | null>(null);
  const checkoutHosts = useMemo(() => readShopifyConfig().checkoutHosts, []);

  useEffect(() => {
    const close = checkoutSheet.addEventListener('close', () => {
      void shopifyStore.refreshCart();
    });
    const completed = checkoutSheet.addEventListener('completed', () => {
      void shopifyStore.refreshCart();
    });
    const error = checkoutSheet.addEventListener('error', () => {
      const checkoutUrl = latestCheckoutUrl.current;
      if (checkoutUrl) void WebBrowser.openBrowserAsync(checkoutUrl);
    });
    return () => {
      close?.remove();
      completed?.remove();
      error?.remove();
    };
  }, [checkoutSheet]);

  return useCallback(
    async (checkoutUrl: string) => {
      const result = await presentCheckout(
        checkoutUrl,
        {
          present: (url) => checkoutSheet.present(url),
          openBrowser: async (url) => {
            await WebBrowser.openBrowserAsync(url);
          },
        },
        checkoutHosts,
      );
      latestCheckoutUrl.current = checkoutUrl;
      return result;
    },
    [checkoutSheet, checkoutHosts],
  );
}
