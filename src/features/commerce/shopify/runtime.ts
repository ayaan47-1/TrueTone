import { createCartAdapter, type CartAdapter } from './cart-adapter';
import { createShopifyCatalog, type ShopifyCatalog } from './catalog';
import { createShopifyClient } from './client';
import { readShopifyConfig } from './env';

export interface ShopifyServices {
  readonly catalog: ShopifyCatalog;
  readonly cart: CartAdapter;
}

let cached: ShopifyServices | null = null;

export function getShopifyServices(): ShopifyServices {
  if (cached) return cached;
  const client = createShopifyClient(readShopifyConfig());
  cached = { catalog: createShopifyCatalog(client), cart: createCartAdapter(client) };
  return cached;
}

export function __setShopifyServicesForTests(services: ShopifyServices | null): void {
  cached = services;
}
