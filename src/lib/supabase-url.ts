// MASVS L1: choose the Supabase URL. Release builds fail closed: a missing or non-https URL throws
// at startup instead of silently pointing the app at plain-HTTP localhost.
export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';

export interface SupabaseUrlInput {
  /** Camera build: never reaches a backend, always the local (unreachable) URL. */
  offline: boolean;
  /** Demo build: stubbed session, never calls the backend. */
  demo: boolean;
  /** __DEV__ (also true under Jest). */
  isDev: boolean;
  envUrl: string | undefined;
}

export function resolveSupabaseUrl({ offline, demo, isDev, envUrl }: SupabaseUrlInput): string {
  if (offline) return LOCAL_SUPABASE_URL;
  const url = (envUrl ?? '').trim();
  if (!url) {
    if (isDev || demo) return LOCAL_SUPABASE_URL;
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is not set for this release build');
  }
  if (!isDev && !url.startsWith('https://')) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must use https in a release build');
  }
  return url;
}

export interface SupabaseAnonKeyInput {
  offline: boolean;
  demo: boolean;
  isDev: boolean;
  envKey: string | undefined;
  /** The local stack's publishable demo key (not a secret). */
  localKey: string;
}

// Holly LOW (N2): same fail-closed rule as the URL. A release build with no anon key throws at
// startup instead of silently using the local demo key (every call would 401).
export function resolveSupabaseAnonKey({ offline, demo, isDev, envKey, localKey }: SupabaseAnonKeyInput): string {
  if (offline) return localKey;
  const key = (envKey ?? '').trim();
  if (key) return key;
  if (isDev || demo) return localKey;
  throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set for this release build');
}
