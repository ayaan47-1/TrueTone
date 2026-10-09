export interface CheckoutPresentation {
  present(url: string): Promise<unknown> | unknown;
  openBrowser(url: string): Promise<unknown>;
}

function assertCheckoutUrl(value: string, storeDomain: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid Shopify checkout URL');
  }
  if (url.protocol !== 'https:' || url.hostname !== storeDomain || !url.pathname.startsWith('/checkouts/')) {
    throw new Error('Invalid Shopify checkout URL');
  }
}

/** Passes Shopify's full URL through untouched so its encoded `_cs` consent survives. */
export async function presentCheckout(
  checkoutUrl: string,
  presentation: CheckoutPresentation,
  storeDomain: string,
): Promise<'sheet' | 'browser'> {
  assertCheckoutUrl(checkoutUrl, storeDomain);
  try {
    await presentation.present(checkoutUrl);
    return 'sheet';
  } catch {
    await presentation.openBrowser(checkoutUrl);
    return 'browser';
  }
}
