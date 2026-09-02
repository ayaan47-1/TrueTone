// src/features/session/latest-read.ts
// Session seam for the live camera shade-match (Phase 1). Holds the LATEST derived
// on-device tone read (a ShadeReadInput) so the result screen can derive the shade,
// persist it, and render it -- without a network round-trip.
//
// Compliance boundary (CLAUDE.md §3): this store holds ONLY the small bundle of derived
// read descriptors (lightness / warmth / olive / skinType / oiliness) -- NEVER the raw
// image, a URI, or bytes. The CV pipeline (owner: read/scan) calls set() right after the
// on-device read (image already deleted); the result route reads it via get()/useLatestRead().
import { useSyncExternalStore } from 'react';
import type { ShadeReadInput } from '../shade/shade-types';

function createStore() {
  let state: ShadeReadInput | null = null;
  const listeners = new Set<() => void>();
  const emit = (): void => { listeners.forEach((l) => l()); };
  return {
    getState: (): ShadeReadInput | null => state,
    /** Alias of getState for call-site readability. */
    get: (): ShadeReadInput | null => state,
    /** Publish the latest on-device tone read. Descriptors only -- no image. */
    set: (read: ShadeReadInput): void => {
      state = { ...read };
      emit();
    },
    reset: (): void => { state = null; emit(); },
    subscribe: (l: () => void): (() => void) => {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
  };
}

export const latestRead = createStore();

/** React hook: the latest on-device tone read, re-rendering on set/reset. */
export function useLatestRead(): ShadeReadInput | null {
  return useSyncExternalStore(
    latestRead.subscribe,
    latestRead.getState,
    latestRead.getState,
  );
}
