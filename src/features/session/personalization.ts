// src/features/session/personalization.ts
// Shared session personalization: whether the user has scanned, and their derived shade.
// currentShade holds ONLY derived descriptors — NEVER the raw image, a URI, or bytes
// (CLAUDE.md §3 compliance boundary). B2 calls setScan() after the on-device read.
import { useSyncExternalStore } from 'react';
import type { Undertone, Finish } from '../../content/makeup-vocab';
import type { ShadeDepth } from '../match/match-types';

export interface CurrentShade {
  shadeName: string;
  undertone: Undertone;
  depth: ShadeDepth;
  finish: Finish;
}

export interface PersonalizationState {
  hasScanned: boolean;
  currentShade: CurrentShade | null;
}

const initialState: PersonalizationState = { hasScanned: false, currentShade: null };

function createStore(initial: PersonalizationState) {
  let state = initial;
  const listeners = new Set<() => void>();
  const emit = (): void => { listeners.forEach((l) => l()); };
  return {
    getState: (): PersonalizationState => state,
    /** Set after a successful on-device read. Descriptors only — no image. */
    setScan: (shade: CurrentShade): void => {
      state = { hasScanned: true, currentShade: { ...shade } };
      emit();
    },
    reset: (): void => { state = initialState; emit(); },
    subscribe: (l: () => void): (() => void) => {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
  };
}

export const personalization = createStore(initialState);

/** React hook: read personalization state, re-rendering on scan/reset. */
export function usePersonalization(): PersonalizationState {
  return useSyncExternalStore(
    personalization.subscribe,
    personalization.getState,
    personalization.getState,
  );
}
