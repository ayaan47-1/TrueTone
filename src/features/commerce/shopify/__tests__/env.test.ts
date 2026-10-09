import { readShopifyConfig } from '../env';

describe('readShopifyConfig', () => {
  it('builds the pinned 2026-10 endpoint from public Expo variables', () => {
    expect(
      readShopifyConfig({
        EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: 'hwqi01-wd.myshopify.com',
        EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: 'public-token',
        EXPO_PUBLIC_SHOPIFY_CHECKOUT_HOSTS: 'hwqi01-wd.myshopify.com,truetone.skin,www.truetone.skin',
      }),
    ).toEqual({
      endpoint: 'https://hwqi01-wd.myshopify.com/api/2026-10/graphql.json',
      storeDomain: 'hwqi01-wd.myshopify.com',
      storefrontToken: 'public-token',
      checkoutHosts: ['hwqi01-wd.myshopify.com', 'truetone.skin', 'www.truetone.skin'],
    });
  });

  it.each([
    [{ EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: 'token' }, 'store domain'],
    [{ EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: 'shop.myshopify.com' }, 'access token'],
    [
      {
        EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: 'shop.myshopify.com',
        EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: 'token',
      },
      'checkout hosts',
    ],
    [
      {
        EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: 'https://shop.myshopify.com',
        EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: 'token',
        EXPO_PUBLIC_SHOPIFY_CHECKOUT_HOSTS: 'shop.myshopify.com',
      },
      'valid myshopify.com hostname',
    ],
    [
      {
        EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: 'shop.myshopify.com',
        EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: 'token',
        EXPO_PUBLIC_SHOPIFY_CHECKOUT_HOSTS: 'shop.myshopify.com,https://truetone.skin',
      },
      'valid hostnames',
    ],
  ])('fails closed for invalid configuration', (env, message) => {
    expect(() => readShopifyConfig(env)).toThrow(message);
  });
});
