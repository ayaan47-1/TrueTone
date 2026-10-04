import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  encryptedStorage,
  migrateLegacyPlaintext,
  wipeEncryptedLocalData,
  ENCRYPTION_KEY_NAME,
  __resetKeyCacheForTests,
} from '../encrypted-storage';

const KEY = 'truetone.diary.v1';

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetKeyCacheForTests();
});

test('write then read round-trips the value', async () => {
  await encryptedStorage.setItem(KEY, '{"2026-10-04":"calm"}');
  expect(await encryptedStorage.getItem(KEY)).toBe('{"2026-10-04":"calm"}');
});

test('the stored value is ciphertext, not the plaintext', async () => {
  await encryptedStorage.setItem(KEY, '{"note":"skin feels tight"}');
  const raw = await AsyncStorage.getItem(KEY);
  expect(raw).not.toBeNull();
  expect(raw).not.toContain('skin feels tight');
  expect(raw!.startsWith('enc1:')).toBe(true);
});

test('the data key lives in SecureStore, device-only, never in AsyncStorage', async () => {
  await encryptedStorage.setItem(KEY, 'x');
  const setCall = (SecureStore.setItemAsync as jest.Mock).mock.calls.find((c) => c[0] === ENCRYPTION_KEY_NAME);
  expect(setCall).toBeDefined();
  expect(setCall![2]).toEqual({ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  expect(await AsyncStorage.getAllKeys()).toEqual([KEY]);
});

test('missing key reads as null', async () => {
  expect(await encryptedStorage.getItem('nope')).toBeNull();
});

test('two writes in parallel share one data key', async () => {
  await Promise.all([encryptedStorage.setItem('a', '1'), encryptedStorage.setItem('b', '2')]);
  __resetKeyCacheForTests();
  expect(await encryptedStorage.getItem('a')).toBe('1');
  expect(await encryptedStorage.getItem('b')).toBe('2');
});

test('legacy plaintext is returned and re-written encrypted on first read', async () => {
  await AsyncStorage.setItem(KEY, '{"2026-10-01":"calm"}');
  expect(await encryptedStorage.getItem(KEY)).toBe('{"2026-10-01":"calm"}');
  const raw = await AsyncStorage.getItem(KEY);
  expect(raw!.startsWith('enc1:')).toBe(true);
  expect(await encryptedStorage.getItem(KEY)).toBe('{"2026-10-01":"calm"}');
});

test('migrateLegacyPlaintext encrypts every managed plaintext key and skips others', async () => {
  await AsyncStorage.multiSet([
    ['truetone.diary.v1', '{"a":1}'],
    ['truetone.routine.u1.v1', '{"b":2}'],
    ['truetone.community.published.v1', '[]'],
    ['truetone.community-profile.v1.u1', '{"username":"x"}'],
    ['truetone.orderHistory.v1', '["p1"]'],
    ['age-gate:verified:u1', '{"userId":"u1"}'],
    ['sb-auth-token', 'leave-me'],
  ]);
  await migrateLegacyPlaintext();
  const all = Object.fromEntries(await AsyncStorage.multiGet(await AsyncStorage.getAllKeys()));
  for (const k of Object.keys(all)) {
    if (k === 'sb-auth-token') expect(all[k]).toBe('leave-me');
    else expect(all[k]!.startsWith('enc1:')).toBe(true);
  }
  expect(await encryptedStorage.getItem('truetone.orderHistory.v1')).toBe('["p1"]');
});

test('migrateLegacyPlaintext never throws when storage fails', async () => {
  jest.spyOn(AsyncStorage, 'getAllKeys').mockRejectedValueOnce(new Error('io'));
  await expect(migrateLegacyPlaintext()).resolves.toBeUndefined();
});

test('corrupt ciphertext reads as null (safe empty), not a throw', async () => {
  await encryptedStorage.setItem(KEY, 'hello');
  const raw = (await AsyncStorage.getItem(KEY))!;
  const flipped = raw.slice(0, -2) + (raw.endsWith('00') ? '11' : '00');
  await AsyncStorage.setItem(KEY, flipped);
  expect(await encryptedStorage.getItem(KEY)).toBeNull();
  await AsyncStorage.setItem(KEY, 'enc1:zz-not-hex');
  expect(await encryptedStorage.getItem(KEY)).toBeNull();
});

test('ciphertext moved to another key does not decrypt there', async () => {
  await encryptedStorage.setItem('a', 'secret');
  await AsyncStorage.setItem('b', (await AsyncStorage.getItem('a'))!);
  expect(await encryptedStorage.getItem('b')).toBeNull();
});

test('ciphertext whose data key is gone reads as null', async () => {
  await encryptedStorage.setItem(KEY, 'hello');
  await SecureStore.deleteItemAsync(ENCRYPTION_KEY_NAME);
  __resetKeyCacheForTests();
  expect(await encryptedStorage.getItem(KEY)).toBeNull();
});

test('a SecureStore read failure rejects (unreadable, not corrupt) so callers can retry', async () => {
  await encryptedStorage.setItem(KEY, 'hello');
  __resetKeyCacheForTests();
  (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('device locked'));
  await expect(encryptedStorage.getItem(KEY)).rejects.toThrow('device locked');
  expect(await encryptedStorage.getItem(KEY)).toBe('hello');
});

test('getAllKeys / removeItem / multiRemove pass through', async () => {
  await encryptedStorage.setItem('a', '1');
  await encryptedStorage.setItem('b', '2');
  expect([...(await encryptedStorage.getAllKeys())].sort()).toEqual(['a', 'b']);
  await encryptedStorage.removeItem('a');
  await encryptedStorage.multiRemove(['b']);
  expect(await encryptedStorage.getAllKeys()).toEqual([]);
});

test('wipeEncryptedLocalData removes every managed key and destroys the data key', async () => {
  await encryptedStorage.setItem('truetone.diary.v1', '{}');
  await encryptedStorage.setItem('truetone.community-profile.v1.u1', '{}');
  await encryptedStorage.setItem('age-gate:verified:u1', '{}');
  await AsyncStorage.setItem('sb-auth-token', 'keep');
  await wipeEncryptedLocalData();
  expect(await AsyncStorage.getAllKeys()).toEqual(['sb-auth-token']);
  expect(await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME)).toBeNull();
  // A fresh write after the wipe works with a new key.
  await encryptedStorage.setItem('truetone.diary.v1', 'again');
  expect(await encryptedStorage.getItem('truetone.diary.v1')).toBe('again');
});
