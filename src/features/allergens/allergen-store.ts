// src/features/allergens/allergen-store.ts
// Encrypted, per-user, on-device store for the allergen profile (design §2.2; CLAUDE.md §1
// "encrypt at rest"). iOS Keychain / Android Keystore via expo-secure-store (D4), pinned to this
// device (no iCloud Keychain sync — founder: no sync). Never synced to a server.
// SecureStore has no key listing, so an index of user ids lets delete-everything purge all.
import * as SecureStore from 'expo-secure-store';
import { parseProfile, type AllergenProfile } from './profile';

const KEY_PREFIX = 'truetone.allergens.';
const KEY_SUFFIX = '.v1';
const INDEX_KEY = 'truetone.allergens.index.v1';
const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export type LoadResult = { status: 'ok'; profile: AllergenProfile | null } | { status: 'error' };

export function allergenKey(userId: string): string {
  if (!SAFE_SEGMENT.test(userId)) throw new Error('invalid-user-id');
  return `${KEY_PREFIX}${userId}${KEY_SUFFIX}`;
}

/** Throws on a corrupt index: never silently shrink it, or delete-everything misses profiles (H4). */
async function readIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY, OPTIONS);
  if (!raw) return [];
  let ids: unknown;
  try {
    ids = JSON.parse(raw);
  } catch {
    throw new Error('allergen-index-corrupt');
  }
  if (!Array.isArray(ids)) throw new Error('allergen-index-corrupt');
  return ids.filter((i): i is string => typeof i === 'string' && SAFE_SEGMENT.test(i));
}

async function writeIndex(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) await SecureStore.deleteItemAsync(INDEX_KEY, OPTIONS);
  else await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids), OPTIONS);
}

/** Fails closed: a read error or a corrupt value is reported, never treated as "no flags" (E17). */
export async function loadAllergenProfile(userId: string): Promise<LoadResult> {
  try {
    const raw = await SecureStore.getItemAsync(allergenKey(userId), OPTIONS);
    if (!raw) return { status: 'ok', profile: null };
    const profile = parseProfile(raw);
    // A value that exists but will not parse is corrupt, not "no flags" (code review H3).
    return profile ? { status: 'ok', profile } : { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}

/** The index is written first, so it always lists at least every stored profile (H4). */
export async function saveAllergenProfile(userId: string, profile: AllergenProfile): Promise<void> {
  const key = allergenKey(userId);
  const ids = await readIndex();
  if (!ids.includes(userId)) await writeIndex([...ids, userId]);
  await SecureStore.setItemAsync(key, JSON.stringify(profile), OPTIONS);
}

export async function clearAllergenProfile(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(allergenKey(userId), OPTIONS);
  // Best effort: a stale id in the index is harmless (deleting a missing key is a no-op).
  try {
    const ids = await readIndex();
    if (ids.includes(userId)) await writeIndex(ids.filter((i) => i !== userId));
  } catch {
    // The profile itself is gone; leave the index for delete-everything.
  }
}

/**
 * Delete-everything / delete-account: purge every profile on this device. Each delete runs on its
 * own, the current user is always deleted even if the index misses them, and any failure is
 * thrown (after every delete was attempted) with the index kept so a retry can finish the job.
 */
export async function clearAllAllergenProfiles(currentUserId?: string | null): Promise<void> {
  const index = await readIndex().then(
    (ids) => ({ ok: true as const, ids }),
    () => ({ ok: false as const, ids: [] as string[] }),
  );
  const ids = currentUserId && !index.ids.includes(currentUserId) ? [...index.ids, currentUserId] : index.ids;
  const results = await Promise.allSettled(ids.map((id) => SecureStore.deleteItemAsync(allergenKey(id), OPTIONS)));
  if (!index.ok) throw new Error('allergen-index-corrupt');
  if (results.some((r) => r.status === 'rejected')) throw new Error('allergen-delete-failed');
  await SecureStore.deleteItemAsync(INDEX_KEY, OPTIONS);
}
