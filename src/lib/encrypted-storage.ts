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
let creating: Promise<Uint8Array> | null = null;

/** Test hook: forget the cached data key so the next call re-reads SecureStore. */
export function __resetKeyCacheForTests(): void {
  cachedKey = null;
  creating = null;
}

function parseKey(stored: string | null): Uint8Array | null {
  if (!stored) return null;
  try {
    const bytes = hexToBytes(stored);
    return bytes.length === KEY_BYTES ? bytes : null;
  } catch {
    return null; // unusable: a write replaces it, and old ciphertext then reads as empty
  }
}

/** The existing data key, or null if none. Rejects if the keychain can't be read. */
async function readKey(): Promise<Uint8Array | null> {
  if (cachedKey) return cachedKey;
  const key = parseKey(await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME, SECURE_OPTS));
  if (key) cachedKey = key;
  return key;
}

/** The data key, created on first write. Single-flight so parallel writes share one key. */
function ensureKey(): Promise<Uint8Array> {
  if (cachedKey) return Promise.resolve(cachedKey);
  if (!creating) {
    creating = (async () => {
      const existing = await readKey();
      if (existing) return existing;
      const fresh = getRandomBytes(KEY_BYTES);
      await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, bytesToHex(fresh), SECURE_OPTS);
      cachedKey = fresh;
      return fresh;
    })().finally(() => {
      creating = null;
    });
  }
  return creating;
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

async function setItem(storageKey: string, value: string): Promise<void> {
  const key = await ensureKey();
  await AsyncStorage.setItem(storageKey, seal(key, storageKey, value));
}

async function getItem(storageKey: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(storageKey);
  if (raw == null) return null;
  if (!raw.startsWith(ENVELOPE)) {
    // Legacy plaintext from before encryption: hand it back and replace it with ciphertext.
    await setItem(storageKey, raw).catch((e: unknown) => console.warn('[encryptedStorage] migrate failed', e));
    return raw;
  }
  const key = await readKey();
  return key ? open(key, storageKey, raw) : null;
}

/** AsyncStorage-shaped, encrypted-at-rest storage for on-device user data. */
export const encryptedStorage = {
  getItem,
  setItem,
  removeItem: (k: string): Promise<void> => AsyncStorage.removeItem(k),
  getAllKeys: (): Promise<readonly string[]> => AsyncStorage.getAllKeys(),
  multiRemove: (keys: readonly string[]): Promise<void> => AsyncStorage.multiRemove([...keys]),
};

/** Encrypt any plaintext left by older builds under the managed prefixes. Never throws. */
export async function migrateLegacyPlaintext(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(isManagedKey);
    if (keys.length === 0) return;
    const pairs = await AsyncStorage.multiGet(keys);
    for (const [k, v] of pairs) {
      if (v != null && !v.startsWith(ENVELOPE)) await setItem(k, v);
    }
  } catch (e) {
    console.warn('[encryptedStorage] plaintext migration failed; will retry next launch', e);
  }
}

/**
 * Delete-everything: remove every managed on-device value and destroy the data key, so any copy
 * that escaped deletion (e.g. an old backup of AsyncStorage) can no longer be decrypted.
 */
export async function wipeEncryptedLocalData(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter(isManagedKey);
  if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  cachedKey = null;
  await SecureStore.deleteItemAsync(ENCRYPTION_KEY_NAME, SECURE_OPTS);
}
