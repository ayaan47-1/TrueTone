import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, DEMO_MODE, CAMERA_DEMO } from './supabase';
import { bootstrapSession } from './auth';
import { isUSRegion } from './region';
import { nextRoute, type Route } from './routing-guard';
import { cameraDemoState } from './camera-demo-profile';

type Profile = { is_18_plus: boolean; consent_active: boolean };
type PolicyVersion = { version: string };
type ConsentReceipt = { policy_version: string };
type Ctx = {
  loading: boolean;
  error: boolean;
  route: Route;
  userId: string | null;
  refresh: () => Promise<void>;
};
const ProfileContext = createContext<Ctx | null>(null);
const MISSING_CURRENT_CONSENT_RPC = 'PGRST202';

async function hasServerCurrentConsent(uid: string): Promise<boolean> {
  const { data: policy, error: policyError } = await supabase
    .from('policy_versions')
    .select('version')
    .eq('doc_key', 'biometric')
    .eq('is_current', true)
    .limit(1)
    .maybeSingle();
  if (policyError) throw new Error('current-policy-load-failed');
  const version = (policy as PolicyVersion | null)?.version;
  if (!version) return false;

  const { data: receipt, error: receiptError } = await supabase
    .from('consent_log')
    .select('policy_version')
    .eq('user_id', uid)
    .eq('action', 'consented')
    .eq('policy_doc_key', 'biometric')
    .eq('policy_version', version)
    .limit(1)
    .maybeSingle();
  if (receiptError) throw new Error('current-consent-receipt-load-failed');
  return (receipt as ConsentReceipt | null)?.policy_version === version;
}

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
    if (CAMERA_DEMO) {
      // Own-device camera prototype (Dwight tt-cam-mode-ruling): no live backend (avoids the
      // plain-HTTP/ATS blocker), but UNLIKE DEMO_MODE the gate flags are NOT pre-cleared -- they
      // come from camera-demo-profile.ts's local state, which only flips true after a real
      // /age-gate or /consent tap (AgeGate.tsx / Consent.tsx). route recomputes correctly on
      // every refresh() call, same as those screens' real onPass wiring.
      setError(false);
      setUserId('camera-demo-user');
      const local = cameraDemoState();
      setRoute(nextRoute({ isUS: true, is18: local.is18, consent: local.consentActive }));
      setLoading(false);
      return;
    }
    try {
      // Clear a previous error only once the reload succeeds: dropping it up front would mount
      // the app on the stale route while a retry is still in flight.
      const uid = await bootstrapSession();
      setUserId(uid);
      const { data, error: e } = await supabase
        .from('profiles')
        .select('is_18_plus, consent_active')
        .eq('id', uid)
        .single();
      if (e || !data) throw new Error('profile-load-failed');
      const p = data as Profile;
      let hasCurrentConsent = false;
      if (p.consent_active) {
        const { data: currentConsent, error: currentConsentError } = await supabase.rpc(
          'has_current_scan_consent',
        );
        if (currentConsentError?.code === MISSING_CURRENT_CONSENT_RPC) {
          // App-before-migration compatibility: use the old readable tables, but still compare
          // against the server's current version. Other RPC errors fail closed.
          hasCurrentConsent = await hasServerCurrentConsent(uid);
        } else {
          if (currentConsentError) throw new Error('current-consent-load-failed');
          hasCurrentConsent = currentConsent === true;
        }
      }
      setRoute(nextRoute({
        isUS: isUSRegion(),
        is18: p.is_18_plus,
        consent: p.consent_active && hasCurrentConsent,
      }));
      setError(false);
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
