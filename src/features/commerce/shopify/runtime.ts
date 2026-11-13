import { createCartAdapter, type CartAdapter } from './cart-adapter';
import type { CatalogCache } from './catalog-cache';
import type { ShopifyCatalog } from './catalog';
import { createApprovedShopifyCatalog, approvedShopifyVariant } from './approved-catalog';
import { getCatalogueState, refreshCatalogue, readApprovedVariant, readApprovedProduct } from '../../match/product-catalog';
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
  const approved=async()=>{
    if(SUPABASE_OFFLINE) throw new Error('The shop is off in this test build');
    await refreshCatalogue();
    const state=getCatalogueState();
    if(state.status!=='ready' && state.status!=='empty') throw new Error('catalogue unavailable');
    return state.products;
  };
  const cart=createCartAdapter(client);
  const catalog = createApprovedShopifyCatalog(client,approved,readApprovedProduct);
  cached = {
    catalog:{...catalog,async getByHandle(handle,after){
      if(SUPABASE_OFFLINE || getCatalogueState().status==='demo') throw new Error('The shop is off in this test build');
      return catalog.getByHandle(handle,after);
    }},
    // A prior Storefront cache cannot establish current label approval or stock.
    catalogCache: OFFLINE_CATALOG_CACHE,
    cart: {...cart,async add(id,quantity){
      if(SUPABASE_OFFLINE) throw new Error('The shop is off in this test build');
      if(!await approvedShopifyVariant(client,readApprovedVariant,id)) throw new Error('shade unavailable');
      return cart.add(id,quantity);
    }},
  };
  return cached;
}

export function __setShopifyServicesForTests(services: ShopifyServices | null): void {
  cached = services;
}
