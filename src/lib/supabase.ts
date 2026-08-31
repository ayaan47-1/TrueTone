import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// EXPO_PUBLIC_* vars are inlined by the Expo bundler at build time. Fall back to the
// local Supabase defaults so the singleton always constructs (e.g. under Jest, where
// the bundler's env inlining does not run). Real builds always supply these via .env.
const LOCAL_URL = 'http://127.0.0.1:54321';
// Local-only publishable anon key (safe to ship; not a secret). Used only as a
// construction fallback so the singleton builds when the bundler hasn't inlined env.
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || LOCAL_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || LOCAL_ANON_KEY;

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

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
