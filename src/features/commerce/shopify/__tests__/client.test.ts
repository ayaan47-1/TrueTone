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
        checkoutHosts: ['hwqi01-wd.myshopify.com'],
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
        checkoutHosts: ['hwqi01-wd.myshopify.com'],
      },
      fetchImpl,
    );

    await expect(client.request('query Bad { shop { name } }', { private: 'never echo me' })).rejects.toMatchObject({
      name: 'ShopifyRequestError',
      kind: 'graphql',
    });
  });

  it('classifies network failures without exposing request variables', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('socket closed'));
    const client = createShopifyClient(
      {
        endpoint: 'https://hwqi01-wd.myshopify.com/api/2026-10/graphql.json',
        storeDomain: 'hwqi01-wd.myshopify.com',
        storefrontToken: 'public-token',
        checkoutHosts: ['hwqi01-wd.myshopify.com'],
      },
      fetchImpl,
    );

    await expect(client.request('query Shop { shop { name } }')).rejects.toMatchObject({
      name: 'ShopifyRequestError',
      kind: 'network',
    });
  });

  it('classifies HTTP failures and retains the response status', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const client = createShopifyClient(
      {
        endpoint: 'https://hwqi01-wd.myshopify.com/api/2026-10/graphql.json',
        storeDomain: 'hwqi01-wd.myshopify.com',
        storefrontToken: 'public-token',
        checkoutHosts: ['hwqi01-wd.myshopify.com'],
      },
      fetchImpl,
    );

    await expect(client.request('query Shop { shop { name } }')).rejects.toMatchObject({
      name: 'ShopifyRequestError',
      kind: 'http',
      status: 503,
    });
  });
});
