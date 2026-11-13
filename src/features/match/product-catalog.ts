import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { DEMO_MODE, SUPABASE_OFFLINE, supabase } from '../../lib/supabase';
import { catalog as demoCatalog } from './demo-product-catalog';
import { createCatalogueRepository, CATALOGUE_COLUMNS, mapCatalogueRow, type CataloguePage } from '../catalog/repository';
import type { Product } from './match-types';
import { createCatalogueState } from '../catalog/state';

export { getSwatchColor } from './demo-product-catalog';
export const catalogueIsDemo = DEMO_MODE;
const repository = createCatalogueRepository({
  async readRevision() {
    const {data,error}=await supabase.rpc('catalog_read_revision');
    if(error || !data) throw Error('catalogue unavailable');
    return data;
  },
  async readPage(after,limit) {
    let query=supabase.from('catalog_recommendable').select(CATALOGUE_COLUMNS).order('variant_gid');
    if(after) query=query.gt('variant_gid',after);
    const {data,error}=await query.limit(limit);
    if(error || !data) throw Error('catalogue unavailable');
    return data;
  },
});
const store = createCatalogueState(repository, { offline: SUPABASE_OFFLINE, demo: DEMO_MODE ? demoCatalog : undefined });

/** Synchronous snapshot for pure consumers. React consumers subscribe with the hook below. */
export let catalog = store.getSnapshot().products;
store.subscribe(() => { catalog = store.getSnapshot().products; });
export const refreshCatalogue = (force = false) => store.load(force);
export const getCatalogueState = store.getSnapshot;
export const loadMoreCatalogue=()=>store.loadMore();
export const loadPreviousCatalogue=()=>store.loadPrevious();

export async function readApprovedVariant(id:string):Promise<Product|null> {
  if(SUPABASE_OFFLINE || DEMO_MODE || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(id)) return null;
  const {data,error}=await supabase.from('catalog_recommendable').select(CATALOGUE_COLUMNS).eq('variant_gid',id).limit(1);
  if(error || !data) throw Error('catalogue unavailable');
  if(!data.length) return null;
  const product=mapCatalogueRow(data[0]);
  if(product.id!==id) throw Error('catalogue unavailable');
  return product;
}

export async function readApprovedProduct(id:string,after:string|null):Promise<CataloguePage> {
  if(SUPABASE_OFFLINE || DEMO_MODE || !/^gid:\/\/shopify\/Product\/\d+$/.test(id)) return {products:[],nextCursor:null};
  let query=supabase.from('catalog_recommendable').select(CATALOGUE_COLUMNS).eq('product_gid',id).order('variant_gid');
  if(after) query=query.gt('variant_gid',after);
  const {data,error}=await query.limit(31);
  if(error || !data) throw Error('catalogue unavailable');
  const products=data.slice(0,30).map(mapCatalogueRow);
  return {products,nextCursor:data.length>30?products.at(-1)?.id??null:null};
}

export function useProductCatalogue() {
  const state = useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
  useEffect(() => {
    void store.load();
    const subscription = AppState.addEventListener('change', status => { if (status === 'active') void store.load(); });
    const timer=setInterval(()=>void store.load(),60_000);
    return () => { subscription.remove(); clearInterval(timer); };
  },[]);
  return state;
}
