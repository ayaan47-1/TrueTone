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
  const [state, setState] = useState<AllergenProfileState>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let live = true;
    if (!userId) {
      setState({ status: 'ready', profile: null });
      return;
    }
    void loadAllergenProfile(userId).then((r) => {
      if (!live) return;
      setState(r.status === 'ok' ? { status: 'ready', profile: r.profile } : { status: 'error' });
    });
    return () => { live = false; };
  }, [userId, tick]);

  return { ...state, reload };
}
