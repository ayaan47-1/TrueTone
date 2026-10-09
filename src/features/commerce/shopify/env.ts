export const SHOPIFY_API_VERSION = '2026-10';

export interface ShopifyConfig {
  readonly endpoint: string;
  readonly storeDomain: string;
  readonly storefrontToken: string;
}

type PublicEnv = Readonly<Record<string, string | undefined>>;

const EXPO_PUBLIC_ENV: PublicEnv = {
  // Expo only inlines EXPO_PUBLIC values when they use static dot notation.
  EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN,
  EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN,
};

export function readShopifyConfig(env: PublicEnv = EXPO_PUBLIC_ENV): ShopifyConfig {
  const storeDomain = env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN?.trim();
  const storefrontToken = env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN?.trim();
  if (!storeDomain) throw new Error('Missing Shopify store domain');
  if (!storefrontToken) throw new Error('Missing Shopify Storefront access token');
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(storeDomain)) {
    throw new Error('Shopify store domain must be a valid myshopify.com hostname');
  }
  return {
    endpoint: `https://${storeDomain}/api/${SHOPIFY_API_VERSION}/graphql.json`,
    storeDomain,
    storefrontToken,
  };
}
