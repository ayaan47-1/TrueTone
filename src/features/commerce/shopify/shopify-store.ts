import { useSyncExternalStore } from 'react';
import { getShopifyServices } from './runtime';
import type { ShopifyCart, ShopifyProduct } from './types';

export interface ShopifyStoreState {
  readonly products: readonly ShopifyProduct[];
  readonly cart: ShopifyCart | null;
  readonly loadingProducts: boolean;
  readonly loadingCart: boolean;
  readonly error: string | null;
}

const EMPTY: ShopifyStoreState = {
  products: [],
  cart: null,
  loadingProducts: false,
  loadingCart: false,
  error: null,
};

let state = EMPTY;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((listener) => listener());
const setState = (next: Partial<ShopifyStoreState>): void => {
  state = { ...state, ...next };
  emit();
};
const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'The shop is unavailable right now.';

export const shopifyStore = {
  getState: (): ShopifyStoreState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async loadProducts(): Promise<void> {
    if (state.loadingProducts || state.products.length) return;
    setState({ loadingProducts: true, error: null });
    try {
      setState({ products: await getShopifyServices().catalog.list(), loadingProducts: false });
    } catch (error) {
      setState({ error: errorMessage(error), loadingProducts: false });
    }
  },
  async loadProduct(handle: string): Promise<ShopifyProduct | null> {
    const existing = state.products.find((product) => product.handle === handle);
    if (existing) return existing;
    setState({ loadingProducts: true, error: null });
    try {
      const product = await getShopifyServices().catalog.getByHandle(handle);
      if (product) setState({ products: [...state.products, product], loadingProducts: false });
      else setState({ loadingProducts: false });
      return product;
    } catch (error) {
      setState({ error: errorMessage(error), loadingProducts: false });
      return null;
    }
  },
  async loadCart(): Promise<void> {
    if (state.loadingCart || state.cart) return;
    setState({ loadingCart: true, error: null });
    try {
      setState({ cart: await getShopifyServices().cart.load(), loadingCart: false });
    } catch (error) {
      setState({ error: errorMessage(error), loadingCart: false });
    }
  },
  async addToCart(merchandiseId: string, quantity = 1): Promise<boolean> {
    setState({ loadingCart: true, error: null });
    try {
      setState({ cart: await getShopifyServices().cart.add(merchandiseId, quantity), loadingCart: false });
      return true;
    } catch (error) {
      setState({ error: errorMessage(error), loadingCart: false });
      return false;
    }
  },
  async updateLine(lineId: string, quantity: number): Promise<void> {
    setState({ loadingCart: true, error: null });
    try {
      const cart = quantity > 0
        ? await getShopifyServices().cart.update(lineId, quantity)
        : await getShopifyServices().cart.remove(lineId);
      setState({ cart, loadingCart: false });
    } catch (error) {
      setState({ error: errorMessage(error), loadingCart: false });
    }
  },
};

export function useShopifyStore(): ShopifyStoreState {
  return useSyncExternalStore(shopifyStore.subscribe, shopifyStore.getState, shopifyStore.getState);
}
