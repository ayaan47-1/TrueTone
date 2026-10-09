export interface CheckoutPresentation {
  present(url: string): Promise<unknown> | unknown;
  openBrowser(url: string): Promise<unknown>;
}

function assertCheckoutUrl(value: string, allowedHosts: readonly string[]): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid Shopify checkout URL');
  }
  const allowedPath = /^\/cart\/c\/[^/]+/.test(url.pathname) || /^\/checkouts\/[^/]+/.test(url.pathname);
  if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname.toLowerCase()) || !allowedPath) {
    throw new Error('Invalid Shopify checkout URL');
  }
}

/** Passes Shopify's full URL through untouched so its encoded `_cs` consent survives. */
export async function presentCheckout(
  checkoutUrl: string,
  presentation: CheckoutPresentation,
  allowedHosts: readonly string[],
): Promise<'sheet' | 'browser'> {
  assertCheckoutUrl(checkoutUrl, allowedHosts);
  try {
    await presentation.present(checkoutUrl);
    return 'sheet';
  } catch {
    await presentation.openBrowser(checkoutUrl);
    return 'browser';
  }
}
