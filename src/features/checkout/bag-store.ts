// src/features/checkout/bag-store.ts
// In-memory shopping bag for the checkout SHELL (build-order: makeup-preview).
// INTERACTION-ONLY: it holds catalog line items (product + qty) so the mock checkout
// flow has something to summarize. Pure client state — no payment data is ever held,
// nothing is persisted, nothing leaves the device. Mirrors the useSyncExternalStore
// store shape already used by `session/personalization.ts`.
import { useSyncExternalStore } from 'react';
import type { Product } from '../match/match-types';

/** One line in the bag: a catalog product, how many of it, and the shade picked (if any). */
export interface BagLine {
  readonly product: Product;
  readonly qty: number;
  /** Shade label chosen on the product page (display data only). */
  readonly shade?: string;
}

/** Identity of a bag line: the same product in two shades is two lines. */
export function lineKey(line: Pick<BagLine, 'product' | 'shade'>): string {
  return `${line.product.id}::${line.shade ?? ''}`;
}

export interface BagState {
  readonly lines: readonly BagLine[];
}

const EMPTY: BagState = { lines: [] };

function createBag(initial: BagState) {
  let state = initial;
  const listeners = new Set<() => void>();
  const emit = (): void => { listeners.forEach((l) => l()); };
  return {
    getState: (): BagState => state,
    /** Add a product in a shade (or bump that line's qty). Immutable update. */
    add: (product: Product, qty = 1, shade?: string): void => {
      const key = lineKey({ product, shade });
      const existing = state.lines.find((l) => lineKey(l) === key);
      const lines = existing
        ? state.lines.map((l) => (lineKey(l) === key ? { ...l, qty: l.qty + qty } : l))
        : [...state.lines, shade === undefined ? { product, qty } : { product, qty, shade }];
      state = { lines };
      emit();
    },
    /** Set one line's quantity; 0 or less removes the line. */
    setQty: (key: string, qty: number): void => {
      state = {
        lines:
          qty > 0
            ? state.lines.map((l) => (lineKey(l) === key ? { ...l, qty } : l))
            : state.lines.filter((l) => lineKey(l) !== key),
      };
      emit();
    },
    /** Drop a line entirely. */
    remove: (id: string): void => {
      state = { lines: state.lines.filter((l) => l.product.id !== id) };
      emit();
    },
    /** Empty the bag (e.g. after a mock order is "placed"). */
    clear: (): void => { state = EMPTY; emit(); },
    subscribe: (l: () => void): (() => void) => {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
  };
}

export const bag = createBag(EMPTY);

/** React hook: read bag state, re-rendering on add/remove/clear. */
export function useBag(): BagState {
  return useSyncExternalStore(bag.subscribe, bag.getState, bag.getState);
}

/** Total item count across all lines (display only). */
export function bagCount(state: BagState): number {
  return state.lines.reduce((n, l) => n + l.qty, 0);
}

/** Whole-USD subtotal — display only; the catalog prices are integers (no tax/ship math). */
export function bagSubtotal(state: BagState): number {
  return state.lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
}
