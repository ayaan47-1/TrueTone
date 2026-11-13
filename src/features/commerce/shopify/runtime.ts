import { createCartAdapter, type CartAdapter } from './cart-adapter';
import type { CatalogCache } from './catalog-cache';
import { createShopifyCatalog, type ShopifyCatalog } from './catalog';
import { createApprovedShopifyCatalog, approvedShopifyVariant } from './approved-catalog';
import { getCatalogueState, refreshCatalogue, readApprovedVariant, readApprovedProduct } from '../../match/product-catalog';
import { createShopifyClient } from './client';
import { readShopifyConfig, type ShopifyConfig } from './env';
import { SUPABASE_OFFLINE, DEMO_MODE } from '../../../lib/supabase';
import type {ShopifyCart} from './types';

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
  const annotate=async(fresh:ShopifyCart):Promise<ShopifyCart>=>{
    if(DEMO_MODE) return fresh;
    if(fresh.subtotal.currencyCode!=='USD' || fresh.lines.some(line=>line.merchandise.price.currencyCode!=='USD' || line.merchandise.compareAtPrice && line.merchandise.compareAtPrice.currencyCode!=='USD')) throw Error('bag currency unavailable');
    if(fresh.lines.reduce((n,line)=>n+line.quantity,0)!==fresh.totalQuantity) throw Error('incomplete bag');
    const unavailableVariantIds:string[]=[];
    for(const line of fresh.lines) {
      if(!await approvedShopifyVariant(client,readApprovedVariant,line.merchandise.id)) unavailableVariantIds.push(line.merchandise.id);
    }
    return {...fresh,unavailableVariantIds};
  };
  const catalog = DEMO_MODE?createShopifyCatalog(client):createApprovedShopifyCatalog(client,approved,readApprovedProduct);
  cached = {
    catalog:{...catalog,async getByHandle(handle,after){
      if(SUPABASE_OFFLINE) throw new Error('The shop is off in this test build');
      return catalog.getByHandle(handle,after);
    }},
    // A prior Storefront cache cannot establish current label approval or stock.
    catalogCache: OFFLINE_CATALOG_CACHE,
    cart: {...cart,async load(){
      if(SUPABASE_OFFLINE) throw new Error('The shop is off in this test build');
      return annotate(await cart.load());
    },async remove(lineId){
      if(SUPABASE_OFFLINE) throw new Error('The shop is off in this test build');
      return annotate(await cart.remove(lineId));
    },async update(lineId,quantity){
      if(SUPABASE_OFFLINE) throw new Error('The shop is off in this test build');
      const fresh=await cart.load();
      const line=fresh.lines.find(line=>line.id===lineId);
      if(!line) throw Error('line unavailable');
      if(quantity>line.quantity && !DEMO_MODE && !await approvedShopifyVariant(client,readApprovedVariant,line.merchandise.id)) throw Error('shade unavailable');
      return annotate(await cart.update(lineId,quantity));
    },async add(id,quantity){
      if(SUPABASE_OFFLINE) throw new Error('The shop is off in this test build');
      if(!await approvedShopifyVariant(client,readApprovedVariant,id)) throw new Error('shade unavailable');
      return annotate(await cart.add(id,quantity));
    }},
  };
  return cached;
}

export function __setShopifyServicesForTests(services: ShopifyServices | null): void {
  cached = services;
}
