import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { DEMO_MODE, SUPABASE_OFFLINE, supabase } from '../../lib/supabase';
import { catalog as demoCatalog } from './demo-product-catalog';
import { createCatalogueRepository, CATALOGUE_COLUMNS } from '../catalog/repository';
import { createCatalogueState } from '../catalog/state';

export { getSwatchColor } from './demo-product-catalog';
export const catalogueIsDemo = DEMO_MODE;
const repository = createCatalogueRepository(async (from,to) => {
  const { data,error } = await supabase.from('catalog_recommendable')
    .select(CATALOGUE_COLUMNS).order('variant_gid').range(from,to);
  if (error || !data) throw new Error('catalogue unavailable');
  return data;
});
const store = createCatalogueState(repository, { offline: SUPABASE_OFFLINE, demo: DEMO_MODE ? demoCatalog : undefined });

/** Synchronous snapshot for pure consumers. React consumers subscribe with the hook below. */
export let catalog = store.getSnapshot().products;
store.subscribe(() => { catalog = store.getSnapshot().products; });
export const refreshCatalogue = (force = false) => store.load(force);
export const getCatalogueState = store.getSnapshot;

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
