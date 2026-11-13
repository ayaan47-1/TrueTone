import type { Product } from '../match/match-types';

export interface CatalogueSnapshot {
  status: 'idle'|'loading'|'ready'|'empty'|'offline'|'demo';
  products: readonly Product[];
  previousProducts: readonly Product[];
}

export function createCatalogueState(repository: { list(): Promise<Product[]> }, options: { offline?: boolean; demo?: readonly Product[] } = {}) {
  let state: CatalogueSnapshot = { status: options.offline ? 'offline' : options.demo ? 'demo' : 'idle', products: options.demo ?? [], previousProducts: [] };
  let pending: Promise<void> | null = null;
  let verifiedAt = 0;
  const listeners = new Set<() => void>();
  const publish = (next: CatalogueSnapshot) => { state = next; listeners.forEach(listener => listener()); };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load(force = false): Promise<void> {
      if (options.offline || options.demo) return Promise.resolve();
      if (pending) return pending;
      if (!force && verifiedAt && Date.now() - verifiedAt < 60_000) return Promise.resolve();
      const previousProducts = state.products.length ? state.products : state.previousProducts;
      publish({ status: 'loading', products: [], previousProducts });
      pending = (async () => {
        try {
          const products = await repository.list();
          verifiedAt = Date.now();
          publish({ status: products.length ? 'ready' : 'empty', products, previousProducts });
        } catch {
          verifiedAt = 0;
          publish({ status: 'offline', products: [], previousProducts });
        } finally { pending = null; }
      })();
      return pending;
    },
  };
}
