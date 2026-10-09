import { presentCheckout } from '../present-checkout';

describe('presentCheckout', () => {
  const checkoutUrl = 'https://truetone.skin/cart/c/Z2NwLXVzLWNlbnRyYWwxOjAxSk?_cs=opaque&key=secret';
  const checkoutHosts = ['hwqi01-wd.myshopify.com', 'truetone.skin', 'www.truetone.skin'];

  it('passes the complete consent-bearing URL to Checkout Sheet unchanged', async () => {
    const present = jest.fn().mockResolvedValue(undefined);
    const openBrowser = jest.fn();

    await expect(
      presentCheckout(checkoutUrl, { present, openBrowser }, checkoutHosts),
    ).resolves.toBe('sheet');
    expect(present).toHaveBeenCalledWith(checkoutUrl);
    expect(openBrowser).not.toHaveBeenCalled();
  });

  it('falls back to the system browser when native presentation fails', async () => {
    const present = jest.fn().mockRejectedValue(new Error('native unavailable'));
    const openBrowser = jest.fn().mockResolvedValue(undefined);

    await expect(
      presentCheckout(checkoutUrl, { present, openBrowser }, checkoutHosts),
    ).resolves.toBe('browser');
    expect(openBrowser).toHaveBeenCalledWith(checkoutUrl);
  });

  it('rejects non-HTTPS and non-Shopify checkout URLs', async () => {
    await expect(
      presentCheckout('https://example.com/checkout?_cs=opaque', {
        present: jest.fn(),
        openBrowser: jest.fn(),
      }, checkoutHosts),
    ).rejects.toThrow('Shopify checkout URL');
  });

  it.each([
    'https://truetone.skin/cart/not-checkout',
    'https://truetone.skin.evil.example/cart/c/token',
    'http://truetone.skin/cart/c/token',
  ])('rejects an unapproved checkout target: %s', async (url) => {
    await expect(
      presentCheckout(url, { present: jest.fn(), openBrowser: jest.fn() }, checkoutHosts),
    ).rejects.toThrow('Shopify checkout URL');
  });
});
