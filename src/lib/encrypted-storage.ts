// src/lib/encrypted-storage.ts
// Encrypted-at-rest wrapper over AsyncStorage for on-device user data (CLAUDE.md §1 "encrypt at
// rest"). Values are sealed with AES-256-GCM (@noble/ciphers, audited) under one random 256-bit
// data key held in the OS keychain/keystore via expo-secure-store (device-only, no backup sync).
// The ciphertext stays in AsyncStorage because SecureStore values are size-limited (~2 KB on iOS).
//
// Reads never throw on bad data: a corrupt, tampered or undecryptable value reads as null (safe
// empty). A keychain READ failure (e.g. device locked) does reject, so callers can treat it as
// "unreadable, retry later" rather than "empty". Legacy plaintext is returned once and re-written
// encrypted in place; `migrateLegacyPlaintext` does the same for every managed key at startup.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getRandomBytes } from 'expo-crypto';
import { gcm } from '@noble/ciphers/aes';
import { bytesToHex, hexToBytes, utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils';

export const ENCRYPTION_KEY_NAME = 'truetone.localDataKey.v1';
const ENVELOPE = 'enc1:';
const NONCE_BYTES = 12;
const KEY_BYTES = 32;
const SECURE_OPTS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/** Key prefixes of the on-device stores this module protects (migration + wipe scope). */
export const MANAGED_KEY_PREFIXES: readonly string[] = [
  'truetone.diary.',
  'truetone.routine.',
  'truetone.community.published.',
  'truetone.community-profile.',
  'truetone.orderHistory.',
  'age-gate:verified:',
];

const isManagedKey = (key: string): boolean => MANAGED_KEY_PREFIXES.some((p) => key.startsWith(p));

let cachedKey: Uint8Array | null = null;

// Every mutation (write, remove, migration, wipe) runs one at a time, in call order. That makes a
// wipe atomic: a write queued before it lands first and is then wiped, and none can land after it
// under the destroyed key. Reads don't queue.
let lock: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn);
  lock = run.catch(() => undefined);
  return run;
}

/** Test hook: forget the cached data key so the next call re-reads SecureStore. */
export function __resetKeyCacheForTests(): void {
  cachedKey = null;
}

function parseKey(stored: string): Uint8Array | null {
  try {
    const bytes = hexToBytes(stored);
    return bytes.length === KEY_BYTES ? bytes : null;
  } catch {
    return null;
  }
}

/** The existing data key, or null if none/unusable. Rejects if the keychain can't be read. */
async function readKey(): Promise<Uint8Array | null> {
  if (cachedKey) return cachedKey;
  const stored = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME, SECURE_OPTS);
  const key = stored ? parseKey(stored) : null;
  if (key) cachedKey = key;
  return key;
}

/**
 * Values sealed under a data key that no longer exists (keychain reset, restore onto another
 * device) can never be opened again. Drop them loudly rather than leave them to read as empty.
 */
async function dropOrphanedCiphertext(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter(isManagedKey);
  const pairs = keys.length > 0 ? await AsyncStorage.multiGet(keys) : [];
  const orphaned = pairs.filter(([, v]) => v?.startsWith(ENVELOPE)).map(([k]) => k);
  if (orphaned.length === 0) return;
  console.warn(`[encryptedStorage] data key missing; dropping ${orphaned.length} unreadable value(s)`);
  await AsyncStorage.multiRemove(orphaned);
}

/** The data key, created on first write. Call only inside `exclusive`. */
async function ensureKey(): Promise<Uint8Array> {
  const existing = await readKey();
  if (existing) return existing;
  const stored = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME, SECURE_OPTS);
  if (stored) console.warn('[encryptedStorage] stored data key is unusable; replacing it');
  await dropOrphanedCiphertext();
  const fresh = getRandomBytes(KEY_BYTES);
  await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, bytesToHex(fresh), SECURE_OPTS);
  cachedKey = fresh;
  return fresh;
}

function seal(key: Uint8Array, storageKey: string, plaintext: string): string {
  const nonce = getRandomBytes(NONCE_BYTES);
  // The storage key is bound as associated data, so a value copied to another key won't open.
  const ct = gcm(key, nonce, utf8ToBytes(storageKey)).encrypt(utf8ToBytes(plaintext));
  return ENVELOPE + bytesToHex(nonce) + bytesToHex(ct);
}

function open(key: Uint8Array, storageKey: string, envelope: string): string | null {
  try {
    const bytes = hexToBytes(envelope.slice(ENVELOPE.length));
    const nonce = bytes.subarray(0, NONCE_BYTES);
    const ct = bytes.subarray(NONCE_BYTES);
    return bytesToUtf8(gcm(key, nonce, utf8ToBytes(storageKey)).decrypt(ct));
  } catch {
    return null; // corrupt or tampered
  }
}

/** Seal and store. Call only inside `exclusive`. */
async function writeSealed(storageKey: string, value: string): Promise<void> {
  const key = await ensureKey();
  await AsyncStorage.setItem(storageKey, seal(key, storageKey, value));
}

/** Encrypt a legacy plaintext value only if it is still the value we read (no lost update). */
function migrateIfUnchanged(storageKey: string, plaintext: string): Promise<void> {
  return exclusive(async () => {
    if ((await AsyncStorage.getItem(storageKey)) === plaintext) await writeSealed(storageKey, plaintext);
  });
}

async function getItem(storageKey: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(storageKey);
  if (raw == null) return null;
  if (!raw.startsWith(ENVELOPE)) {
    // Legacy plaintext from before encryption: hand it back and replace it with ciphertext.
    await migrateIfUnchanged(storageKey, raw).catch(() =>
      console.warn('[encryptedStorage] could not encrypt a legacy value; will retry'),
    );
    return raw;
  }
  const key = await readKey();
  return key ? open(key, storageKey, raw) : null;
}

/** AsyncStorage-shaped, encrypted-at-rest storage for on-device user data. */
export const encryptedStorage = {
  getItem,
  setItem: (k: string, v: string): Promise<void> => exclusive(() => writeSealed(k, v)),
  removeItem: (k: string): Promise<void> => exclusive(() => AsyncStorage.removeItem(k)),
  getAllKeys: (): Promise<readonly string[]> => AsyncStorage.getAllKeys(),
  multiRemove: (keys: readonly string[]): Promise<void> => exclusive(() => AsyncStorage.multiRemove([...keys])),
};

/** Encrypt any plaintext left by older builds under the managed prefixes. Never throws. */
export async function migrateLegacyPlaintext(): Promise<void> {
  let pairs: readonly (readonly [string, string | null])[];
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(isManagedKey);
    pairs = keys.length > 0 ? await AsyncStorage.multiGet(keys) : [];
  } catch {
    console.warn('[encryptedStorage] plaintext migration could not list keys; will retry next launch');
    return;
  }
  for (const [k, v] of pairs) {
    if (v == null || v.startsWith(ENVELOPE)) continue;
    // One failure (e.g. keychain locked) doesn't stop the rest; a later read retries it.
    await migrateIfUnchanged(k, v).catch(() =>
      console.warn('[encryptedStorage] could not encrypt a legacy value; will retry'),
    );
  }
}

/**
 * Delete-everything: remove every managed on-device value and destroy the data key, so any copy
 * that escaped deletion (e.g. an old backup of AsyncStorage) can no longer be decrypted. The key
 * is destroyed even if removing the values fails; that failure is still reported.
 */
export function wipeEncryptedLocalData(): Promise<void> {
  return exclusive(async () => {
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter(isManagedKey);
      if (keys.length > 0) await AsyncStorage.multiRemove(keys);
    } finally {
      cachedKey = null;
      await SecureStore.deleteItemAsync(ENCRYPTION_KEY_NAME, SECURE_OPTS);
    }
  });
}
