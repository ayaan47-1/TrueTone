// src/features/shop/wishlist-store.ts
// In-memory saved items (the v3 heart buttons). Pure client state: product ids only,
// nothing persisted, nothing leaves the device. Same useSyncExternalStore shape as bag-store.
import { useSyncExternalStore } from 'react';

function createWishlist() {
  let state: readonly string[] = [];
  const listeners = new Set<() => void>();
  const set = (next: readonly string[]): void => {
    state = next;
    listeners.forEach((l) => l());
  };
  return {
    getState: (): readonly string[] => state,
    /** Save or unsave a product. Immutable update. */
    toggle: (id: string): void => set(state.includes(id) ? state.filter((x) => x !== id) : [...state, id]),
    clear: (): void => set([]),
    subscribe: (l: () => void): (() => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

export const wishlist = createWishlist();

/** React hook: the saved product ids, re-rendering on change. */
export function useWishlist(): readonly string[] {
  return useSyncExternalStore(wishlist.subscribe, wishlist.getState, wishlist.getState);
}
