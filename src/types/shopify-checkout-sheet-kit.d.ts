declare module '@shopify/checkout-sheet-kit' {
  import type { PropsWithChildren, ReactElement } from 'react';

  export interface ShopifyCheckoutSheet {
    present(checkoutUrl: string): Promise<void> | void;
  }
  export function useShopifyCheckoutSheet(): ShopifyCheckoutSheet;
  export function ShopifyCheckoutSheetProvider(props: PropsWithChildren): ReactElement;
}

declare module 'expo-web-browser' {
  export function openBrowserAsync(url: string): Promise<unknown>;
}
