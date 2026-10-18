import { useSyncExternalStore } from 'react';
import { getShopifyServices } from './runtime';
import type { ShopifyCart, ShopifyProduct } from './types';

export interface ShopifyStoreState {
  readonly products: readonly ShopifyProduct[];
  readonly cart: ShopifyCart | null;
  readonly loadingProducts: boolean;
  readonly loadingCart: boolean;
  readonly error: string | null;
  readonly catalogStatus: 'empty' | 'live' | 'cached';
  readonly catalogUpdatedAt: number | null;
  readonly liveProductHandles: readonly string[];
  readonly cartOnline: boolean;
}

const EMPTY: ShopifyStoreState = {
  products: [],
  cart: null,
  loadingProducts: false,
  loadingCart: false,
  error: null,
  catalogStatus: 'empty',
  catalogUpdatedAt: null,
  liveProductHandles: [],
  cartOnline: false,
};

let state = EMPTY;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((listener) => listener());
const setState = (next: Partial<ShopifyStoreState>): void => {
  state = { ...state, ...next };
  emit();
};
const errorMessage = (_error?: unknown): string => 'The shop is unavailable right now. Please try again.';

export const shopifyStore = {
  getState: (): ShopifyStoreState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async loadProducts(): Promise<void> {
    if (state.loadingProducts || (state.catalogStatus === 'live' && state.products.length > 0)) return;
    setState({ loadingProducts: true, error: null });
    const services = getShopifyServices();
    let hasCachedProducts = state.catalogStatus === 'cached' && state.products.length > 0;
    if (!hasCachedProducts) {
      try {
        const snapshot = await services.catalogCache.read();
        if (snapshot?.products.length) {
          hasCachedProducts = true;
          setState({
            products: snapshot.products,
            catalogStatus: 'cached',
            catalogUpdatedAt: snapshot.updatedAt,
            liveProductHandles: [],
          });
        }
      } catch {
        // A cache read failure must not block the live catalog request.
      }
    }
    try {
      const products = await services.catalog.list();
      const updatedAt = Date.now();
      setState({
        products,
        catalogStatus: 'live',
        catalogUpdatedAt: updatedAt,
        liveProductHandles: products.map((product) => product.handle),
        loadingProducts: false,
        error: null,
      });
      await services.catalogCache.write({ products, updatedAt }).catch(() => undefined);
    } catch (error) {
      setState({
        error: errorMessage(error),
        loadingProducts: false,
        catalogStatus: hasCachedProducts ? 'cached' : 'empty',
      });
    }
  },
  async loadProduct(handle: string): Promise<ShopifyProduct | null> {
    const existing = state.products.find((product) => product.handle === handle);
    if (existing) return existing;
    setState({ loadingProducts: true, error: null });
    try {
      const product = await getShopifyServices().catalog.getByHandle(handle);
      if (product) {
        setState({
          products: [...state.products, product],
          liveProductHandles: state.liveProductHandles.includes(product.handle)
            ? state.liveProductHandles
            : [...state.liveProductHandles, product.handle],
          loadingProducts: false,
        });
      }
      else setState({ loadingProducts: false });
      return product;
    } catch (error) {
      setState({ error: errorMessage(error), loadingProducts: false });
      return null;
    }
  },
  async loadCart(): Promise<void> {
    if (state.loadingCart) return;
    setState({ loadingCart: true, error: null });
    try {
      setState({ cart: await getShopifyServices().cart.load(), loadingCart: false, cartOnline: true });
    } catch (error) {
      setState({ error: errorMessage(error), loadingCart: false, cartOnline: false });
    }
  },
  async refreshCart(): Promise<ShopifyCart | null> {
    setState({ loadingCart: true, error: null });
    try {
      const cart = await getShopifyServices().cart.load();
      setState({ cart, loadingCart: false, cartOnline: true });
      return cart;
    } catch {
      setState({ error: errorMessage(), loadingCart: false, cartOnline: false });
      return null;
    }
  },
  async addToCart(merchandiseId: string, quantity = 1): Promise<boolean> {
    setState({ loadingCart: true, error: null });
    try {
      setState({
        cart: await getShopifyServices().cart.add(merchandiseId, quantity),
        loadingCart: false,
        cartOnline: true,
      });
      return true;
    } catch (error) {
      setState({ error: errorMessage(error), loadingCart: false, cartOnline: false });
      return false;
    }
  },
  async updateLine(lineId: string, quantity: number): Promise<void> {
    setState({ loadingCart: true, error: null });
    try {
      const cart = quantity > 0
        ? await getShopifyServices().cart.update(lineId, quantity)
        : await getShopifyServices().cart.remove(lineId);
      setState({ cart, loadingCart: false, cartOnline: true });
    } catch (error) {
      setState({ error: errorMessage(error), loadingCart: false, cartOnline: false });
    }
  },
};

export function __resetShopifyStoreForTests(): void {
  state = EMPTY;
  emit();
}

export function useShopifyStore(): ShopifyStoreState {
  return useSyncExternalStore(shopifyStore.subscribe, shopifyStore.getState, shopifyStore.getState);
}
