import { CART_CREATE } from '../graphql';
import { createCartAdapter, SHOPIFY_CART_STORAGE_KEY } from '../cart-adapter';
import { ShopifyRequestError, type ShopifyClient } from '../client';

describe('Shopify cart adapter', () => {
  const storage = {
    getItem: jest.fn<Promise<string | null>, [string]>(),
    setItem: jest.fn<Promise<void>, [string, string]>(),
    removeItem: jest.fn<Promise<void>, [string]>(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('creates a guest cart with all visitor consent purposes false and stores only its ID', async () => {
    storage.getItem.mockResolvedValue(null);
    const request = jest.fn().mockResolvedValue({
      cartCreate: {
        cart: {
          id: 'gid://shopify/Cart/cart-id',
          checkoutUrl: 'https://hwqi01-wd.myshopify.com/cart/c/Z2NwLXVzLWNlbnRyYWwxOjAxSk?key=opaque',
          totalQuantity: 1,
          lines: { nodes: [] },
          cost: { subtotalAmount: { amount: '24.00', currencyCode: 'USD' } },
        },
        userErrors: [],
      },
    });
    const adapter = createCartAdapter({ request } as ShopifyClient, storage);

    const cart = await adapter.add('gid://shopify/ProductVariant/2', 1);

    expect(request).toHaveBeenCalledWith(CART_CREATE, {
      lines: [{ merchandiseId: 'gid://shopify/ProductVariant/2', quantity: 1 }],
    });
    expect(storage.setItem).toHaveBeenCalledWith(SHOPIFY_CART_STORAGE_KEY, cart.id);
    expect(CART_CREATE).toContain(
      '@inContext(visitorConsent: { analytics: false, preferences: false, marketing: false, saleOfData: false })',
    );
    expect(JSON.stringify(request.mock.calls)).not.toMatch(/email|phone|customerAccessToken|scan|score|shade/i);
  });

  it('clears a stale stored cart and creates a new one', async () => {
    storage.getItem.mockResolvedValue('gid://shopify/Cart/stale');
    const request = jest
      .fn()
      .mockResolvedValueOnce({ cart: null })
      .mockResolvedValueOnce({
        cartCreate: {
          cart: {
            id: 'gid://shopify/Cart/new',
            checkoutUrl: 'https://hwqi01-wd.myshopify.com/cart/c/new?key=opaque',
            totalQuantity: 0,
            lines: { nodes: [] },
            cost: { subtotalAmount: { amount: '0.00', currencyCode: 'USD' } },
          },
          userErrors: [],
        },
      });
    const adapter = createCartAdapter({ request } as ShopifyClient, storage);

    await expect(adapter.load()).resolves.toEqual(expect.objectContaining({ id: 'gid://shopify/Cart/new' }));
    expect(storage.removeItem).toHaveBeenCalledWith(SHOPIFY_CART_STORAGE_KEY);
  });

  it('drops a stored cart ID and recreates once when Shopify rejects the cart query', async () => {
    storage.getItem.mockResolvedValue('gid://shopify/Cart/foreign');
    const request = jest
      .fn()
      .mockRejectedValueOnce(new ShopifyRequestError('Invalid global id'))
      .mockResolvedValueOnce({
        cartCreate: {
          cart: {
            id: 'gid://shopify/Cart/recovered',
            checkoutUrl: 'https://hwqi01-wd.myshopify.com/cart/c/recovered?key=opaque',
            totalQuantity: 0,
            lines: { nodes: [] },
            cost: { subtotalAmount: { amount: '0.00', currencyCode: 'USD' } },
          },
          userErrors: [],
        },
      });
    const adapter = createCartAdapter({ request } as ShopifyClient, storage);

    await expect(adapter.load()).resolves.toEqual(expect.objectContaining({ id: 'gid://shopify/Cart/recovered' }));
    expect(storage.removeItem).toHaveBeenCalledWith(SHOPIFY_CART_STORAGE_KEY);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
