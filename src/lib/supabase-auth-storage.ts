import { encryptedStorage } from './encrypted-storage';

function warnReadFailure(): void {
  console.warn('[supabaseAuthStorage] read failed; treating the session as unavailable');
}

/**
 * Supabase auth storage backed by encrypted AsyncStorage. The encrypted layer migrates a legacy
 * plaintext value on first read. A read failure is never allowed to escape into supabase-js; it
 * fails closed as signed out. Write/removal failures still reject so supabase-js cannot report a
 * session as persisted or cleared when the underlying storage operation failed.
 */
export const supabaseAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await encryptedStorage.getItem(key);
    } catch {
      warnReadFailure();
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    await encryptedStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    await encryptedStorage.removeItem(key);
  },
};
