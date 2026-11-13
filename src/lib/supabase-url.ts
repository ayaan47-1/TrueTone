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
