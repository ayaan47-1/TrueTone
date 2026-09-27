// src/features/allergens/use-allergen-profile.ts
// Loads the user's on-device allergen profile. 'error' is surfaced (C11), never read as "no flags".
import { useCallback, useEffect, useState } from 'react';
import { loadAllergenProfile } from './allergen-store';
import type { AllergenProfile } from './profile';

export type AllergenProfileState =
  | { status: 'loading' }
  | { status: 'ready'; profile: AllergenProfile | null }
  | { status: 'error' };

export function useAllergenProfile(userId: string | null): AllergenProfileState & { reload: () => void } {
  // The state remembers which user it belongs to, so a userId change reads as 'loading' at once and
  // never shows (or lets the editor save over) the previous user's profile (code review M5). A plain
  // reload for the same user keeps the current data on screen (no flicker).
  const [state, setState] = useState<{ owner: string | null; value: AllergenProfileState }>({
    owner: userId, value: { status: 'loading' },
  });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let live = true;
    if (!userId) {
      setState({ owner: null, value: { status: 'ready', profile: null } });
      return;
    }
    void loadAllergenProfile(userId).then((r) => {
      if (!live) return;
      setState({ owner: userId, value: r.status === 'ok' ? { status: 'ready', profile: r.profile } : { status: 'error' } });
    });
    return () => { live = false; };
  }, [userId, tick]);

  const value: AllergenProfileState = state.owner === userId ? state.value : { status: 'loading' };
  return { ...value, reload };
}
