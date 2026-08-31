import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, DEMO_MODE } from './supabase';
import { bootstrapSession } from './auth';
import { isUSRegion } from './region';
import { nextRoute, type Route } from './routing-guard';

type Profile = { is_18_plus: boolean; consent_active: boolean };
type Ctx = {
  loading: boolean;
  error: boolean;
  route: Route;
  userId: string | null;
  refresh: () => Promise<void>;
};
const ProfileContext = createContext<Ctx | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [route, setRoute] = useState<Route>('region-blocked');
  const [userId, setUserId] = useState<string | null>(null);

  async function refresh() {
    if (DEMO_MODE) {
      // Offline demo: stand in a stubbed onboarded identity and skip the backend so the
      // Shop + Today screens render from the local catalog with no Supabase. The gate
      // logic is untouched — this is the same route a real US, 18+, consented user hits.
      setError(false);
      setUserId('demo-user');
      setRoute(nextRoute({ isUS: true, is18: true, consent: true }));
      setLoading(false);
      return;
    }
    try {
      setError(false);
      const uid = await bootstrapSession();
      setUserId(uid);
      const { data, error: e } = await supabase
        .from('profiles')
        .select('is_18_plus, consent_active')
        .eq('id', uid)
        .single();
      if (e || !data) throw new Error('profile-load-failed');
      const p = data as Profile;
      setRoute(nextRoute({ isUS: isUSRegion(), is18: p.is_18_plus, consent: p.consent_active }));
    } catch {
      setError(true); // fail closed: never advance on unknown identity
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <ProfileContext.Provider value={{ loading, error, route, userId, refresh }}>
      {children}
    </ProfileContext.Provider>
  );
}
export function useProfile() {
  const c = useContext(ProfileContext);
  if (!c) throw new Error('useProfile outside provider');
  return c;
}
