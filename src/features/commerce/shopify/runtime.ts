import { createCartAdapter, type CartAdapter } from './cart-adapter';
import { createCatalogCache, type CatalogCache } from './catalog-cache';
import { createShopifyCatalog, type ShopifyCatalog } from './catalog';
import { createShopifyClient } from './client';
import { readShopifyConfig, type ShopifyConfig } from './env';
import { SUPABASE_OFFLINE } from '../../../lib/supabase';

// Camera build: Shopify values are blank (readShopifyConfig would throw) and must be ignored even
// if present. The client refuses every request; this config is never sent anywhere.
const OFFLINE_CONFIG: ShopifyConfig = { endpoint: '', storeDomain: '', storefrontToken: '', checkoutHosts: [] };

// Camera build: never show a previously cached catalog; its images would load from Shopify's CDN.
const OFFLINE_CATALOG_CACHE: CatalogCache = {
  read: async () => null,
  write: async () => undefined,
};

export interface ShopifyServices {
  readonly catalog: ShopifyCatalog;
  readonly catalogCache: CatalogCache;
  readonly cart: CartAdapter;
}

let cached: ShopifyServices | null = null;

export function getShopifyServices(): ShopifyServices {
  if (cached) return cached;
  const client = createShopifyClient(SUPABASE_OFFLINE ? OFFLINE_CONFIG : readShopifyConfig());
  cached = {
    catalog: createShopifyCatalog(client),
    catalogCache: SUPABASE_OFFLINE ? OFFLINE_CATALOG_CACHE : createCatalogCache(),
    cart: createCartAdapter(client),
  };
  return cached;
}

export function __setShopifyServicesForTests(services: ShopifyServices | null): void {
  cached = services;
}
