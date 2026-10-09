import { presentCheckout } from '../present-checkout';

describe('presentCheckout', () => {
  const checkoutUrl = 'https://hwqi01-wd.myshopify.com/checkouts/test?_cs=opaque';

  it('passes the complete consent-bearing URL to Checkout Sheet unchanged', async () => {
    const present = jest.fn().mockResolvedValue(undefined);
    const openBrowser = jest.fn();

    await expect(
      presentCheckout(checkoutUrl, { present, openBrowser }, 'hwqi01-wd.myshopify.com'),
    ).resolves.toBe('sheet');
    expect(present).toHaveBeenCalledWith(checkoutUrl);
    expect(openBrowser).not.toHaveBeenCalled();
  });

  it('falls back to the system browser when native presentation fails', async () => {
    const present = jest.fn().mockRejectedValue(new Error('native unavailable'));
    const openBrowser = jest.fn().mockResolvedValue(undefined);

    await expect(
      presentCheckout(checkoutUrl, { present, openBrowser }, 'hwqi01-wd.myshopify.com'),
    ).resolves.toBe('browser');
    expect(openBrowser).toHaveBeenCalledWith(checkoutUrl);
  });

  it('rejects non-HTTPS and non-Shopify checkout URLs', async () => {
    await expect(
      presentCheckout('https://example.com/checkout?_cs=opaque', {
        present: jest.fn(),
        openBrowser: jest.fn(),
      }, 'hwqi01-wd.myshopify.com'),
    ).rejects.toThrow('Shopify checkout URL');
  });
});
