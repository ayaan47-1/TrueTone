import { createShopifyClient, ShopifyRequestError } from '../client';

describe('Shopify Storefront client', () => {
  it('posts only to the configured endpoint with the public Storefront token', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { shop: { name: 'TrueTone' } } }),
    });
    const client = createShopifyClient(
      {
        endpoint: 'https://hwqi01-wd.myshopify.com/api/2026-10/graphql.json',
        storeDomain: 'hwqi01-wd.myshopify.com',
        storefrontToken: 'public-token',
      },
      fetchImpl,
    );

    await expect(client.request('query Shop { shop { name } }')).resolves.toEqual({
      shop: { name: 'TrueTone' },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://hwqi01-wd.myshopify.com/api/2026-10/graphql.json',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': 'public-token',
        },
      }),
    );
  });

  it('surfaces GraphQL errors without logging request variables', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: 'Denied' }] }),
    });
    const client = createShopifyClient(
      {
        endpoint: 'https://hwqi01-wd.myshopify.com/api/2026-10/graphql.json',
        storeDomain: 'hwqi01-wd.myshopify.com',
        storefrontToken: 'public-token',
      },
      fetchImpl,
    );

    await expect(client.request('query Bad { shop { name } }', { private: 'never echo me' })).rejects.toBeInstanceOf(
      ShopifyRequestError,
    );
  });
});
