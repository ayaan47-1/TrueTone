import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { supabaseAuthStorage } from './supabase-auth-storage';
import { LOCAL_SUPABASE_URL, resolveSupabaseAnonKey, resolveSupabaseUrl } from './supabase-url';

// EXPO_PUBLIC_* vars are inlined by the Expo bundler at build time. Dev builds and Jest (where
// the bundler's env inlining does not run) fall back to the local Supabase defaults; a release
// build without an https URL throws at startup instead (MASVS L1, see supabase-url.ts).
// Local-only publishable anon key (safe to ship; not a secret). Used only as a
// construction fallback so the singleton builds when the bundler hasn't inlined env.
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

/**
 * Demo / offline mode. When EXPO_PUBLIC_DEMO is truthy the app runs against a stubbed
 * session + profile and never calls the backend, so Shop + Today render from the local
 * catalog with no Supabase running. Defaults OFF — a missing/empty/"0"/"false" value
 * keeps normal auth. This is a developer/demo preview convenience ONLY: it does NOT
 * relax the age-gate or consent logic, it stands in an already-onboarded 18+, consented
 * identity (the same route a real onboarded user reaches) so the makeup screens are
 * viewable without a backend. Never enable it for a production build.
 */
export const DEMO_MODE = /^(1|true|yes|on)$/i.test(
  (process.env.EXPO_PUBLIC_DEMO ?? '').trim(),
);

/**
 * Camera-demo / own-device-prototype mode (tt-cam-pipeline, Dwight tt-cam-mode-ruling PASS,
 * conditions in that ruling). UNLIKE DEMO_MODE, this does NOT stub an already-onboarded
 * identity: profile-context.tsx still drives the real /age-gate + /consent chain, it just
 * persists the resulting flags to local state (camera-demo-profile.ts) instead of Supabase,
 * so the flow still works with no live backend (avoids the plain-HTTP/ATS blocker). This is
 * what makes /scan reachable under this mode -- ONLY after real taps, never pre-resolved.
 * MUST default OFF. It may reach ONLY the three named principals (docs/ops/
 * camera-on-testflight-compliance.md §12): direct-install, or the founder's internal-TestFlight
 * override (eas profile testflight-camera) while that group is exactly those three. Never a
 * prod-connected build. Never both this and DEMO_MODE true in the same build.
 */
export const CAMERA_DEMO = /^(1|true|yes|on)$/i.test(
  (process.env.EXPO_PUBLIC_CAMERA_DEMO ?? '').trim(),
);

/**
 * The camera build must never reach a live backend (Dwight FAIL on PR #60), even if a production
 * URL or key leaks into its environment. Under CAMERA_DEMO the client ignores
 * EXPO_PUBLIC_SUPABASE_*, keeps no session on disk, never refreshes one, and its fetch rejects
 * before any request leaves the device, so every rpc / table / function / auth call fails closed.
 */
export const SUPABASE_OFFLINE = CAMERA_DEMO;

export const SUPABASE_TARGET_URL = resolveSupabaseUrl({
  offline: SUPABASE_OFFLINE,
  demo: DEMO_MODE,
  isDev: typeof __DEV__ !== 'undefined' && __DEV__,
  envUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
});
const anonKey = resolveSupabaseAnonKey({
  offline: SUPABASE_OFFLINE,
  demo: DEMO_MODE,
  isDev: typeof __DEV__ !== 'undefined' && __DEV__,
  envKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  localKey: LOCAL_ANON_KEY,
});

export const SUPABASE_AUTH_OPTIONS = SUPABASE_OFFLINE
  ? { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  : {
      storage: supabaseAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    };

export const OFFLINE_ERROR_MESSAGE = 'camera-demo-offline';

const offlineFetch: typeof fetch = () => Promise.reject(new Error(OFFLINE_ERROR_MESSAGE));

export const supabase = createClient(SUPABASE_TARGET_URL, anonKey, {
  auth: SUPABASE_AUTH_OPTIONS,
  ...(SUPABASE_OFFLINE ? { global: { fetch: offlineFetch } } : {}),
});
