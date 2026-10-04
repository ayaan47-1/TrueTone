import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  encryptedStorage,
  migrateLegacyPlaintext,
  wipeEncryptedLocalData,
  ENCRYPTION_KEY_NAME,
  AUTH_SESSION_ENCRYPTION_KEY_NAME,
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

test('migrateLegacyPlaintext encrypts every managed plaintext key, including auth, and skips others', async () => {
  await AsyncStorage.multiSet([
    ['truetone.diary.v1', '{"a":1}'],
    ['truetone.routine.u1.v1', '{"b":2}'],
    ['truetone.community.published.v1', '[]'],
    ['truetone.community-profile.v1.u1', '{"username":"x"}'],
    ['truetone.orderHistory.v1', '["p1"]'],
    ['age-gate:verified:u1', '{"userId":"u1"}'],
    ['sb-auth-token', 'leave-me'],
    ['unmanaged-key', 'leave-me-plain'],
  ]);
  await migrateLegacyPlaintext();
  const all = Object.fromEntries(await AsyncStorage.multiGet(await AsyncStorage.getAllKeys()));
  for (const k of Object.keys(all)) {
    if (k === 'unmanaged-key') expect(all[k]).toBe('leave-me-plain');
    else expect(all[k]!.startsWith('enc1:')).toBe(true);
  }
  expect(await encryptedStorage.getItem('truetone.orderHistory.v1')).toBe('["p1"]');
  expect(await encryptedStorage.getItem('sb-auth-token')).toBe('leave-me');
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

test('default wipe removes every managed personal-data key but preserves auth', async () => {
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

test('default wipe preserves the independently encrypted Supabase auth session', async () => {
  const authKey = 'sb-project-auth-token';
  await encryptedStorage.setItem(KEY, 'personal');
  await encryptedStorage.setItem(authKey, 'session');

  await wipeEncryptedLocalData();

  expect(await encryptedStorage.getItem(KEY)).toBeNull();
  expect(await encryptedStorage.getItem(authKey)).toBe('session');
  expect(await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME)).toBeNull();
  expect(await SecureStore.getItemAsync(AUTH_SESSION_ENCRYPTION_KEY_NAME)).not.toBeNull();
});

test('account wipe removes the Supabase auth session and both encryption keys', async () => {
  const authKey = 'sb-project-auth-token';
  await encryptedStorage.setItem(KEY, 'personal');
  await encryptedStorage.setItem(authKey, 'session');

  await wipeEncryptedLocalData({ includeAuthSession: true });

  expect(await encryptedStorage.getItem(KEY)).toBeNull();
  expect(await encryptedStorage.getItem(authKey)).toBeNull();
  expect(await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME)).toBeNull();
  expect(await SecureStore.getItemAsync(AUTH_SESSION_ENCRYPTION_KEY_NAME)).toBeNull();
});

describe('races and recovery (review fixes)', () => {
  test('a write started before a wipe cannot land after it (no resurrected data)', async () => {
    await encryptedStorage.setItem(KEY, 'old');
    __resetKeyCacheForTests();
    const write = encryptedStorage.setItem(KEY, 'late');
    const wipe = wipeEncryptedLocalData();
    await Promise.all([write, wipe]);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME)).toBeNull();
  });

  test('a key being created during a wipe does not survive the wipe', async () => {
    const write = encryptedStorage.setItem(KEY, 'first');
    await wipeEncryptedLocalData();
    await write;
    expect(await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME)).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  test('migration never overwrites a newer encrypted write with stale plaintext', async () => {
    await AsyncStorage.setItem(KEY, '{"stale":true}');
    const realMultiGet = AsyncStorage.multiGet;
    jest.spyOn(AsyncStorage, 'multiGet').mockImplementationOnce(async (keys) => {
      const snapshot = await realMultiGet(keys);
      await encryptedStorage.setItem(KEY, '{"fresh":true}'); // a store writes mid-migration
      return snapshot;
    });
    await migrateLegacyPlaintext();
    expect(await encryptedStorage.getItem(KEY)).toBe('{"fresh":true}');
  });

  test('one key failing to migrate does not stop the others', async () => {
    await AsyncStorage.multiSet([
      ['truetone.diary.v1', '{"a":1}'],
      ['truetone.orderHistory.v1', '["p1"]'],
    ]);
    // The async-storage mock's methods are already jest.fn()s: swap the implementation and put
    // the original back (mockRestore would erase it for every later test).
    const setItem = AsyncStorage.setItem as jest.Mock;
    const original = setItem.getMockImplementation()!;
    setItem.mockImplementation(async (k: string, v: string) => {
      if (k === 'truetone.diary.v1') throw new Error('io');
      return original(k, v);
    });
    try {
      await migrateLegacyPlaintext();
    } finally {
      setItem.mockImplementation(original);
    }
    expect((await AsyncStorage.getItem('truetone.orderHistory.v1'))!.startsWith('enc1:')).toBe(true);
  });

  test('ciphertext orphaned by a lost data key is dropped (with a warning) before a new key is made', async () => {
    await encryptedStorage.setItem('truetone.orderHistory.v1', '["p1"]');
    await SecureStore.deleteItemAsync(ENCRYPTION_KEY_NAME);
    __resetKeyCacheForTests();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await encryptedStorage.setItem(KEY, 'new');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('data key missing'));
    warn.mockRestore();
    expect(await AsyncStorage.getItem('truetone.orderHistory.v1')).toBeNull();
    expect(await encryptedStorage.getItem(KEY)).toBe('new');
  });

  test('an unusable stored key is treated as lost, not silently reused', async () => {
    await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, 'not-hex');
    jest.spyOn(console, 'warn').mockImplementationOnce(() => {});
    await encryptedStorage.setItem(KEY, 'v');
    __resetKeyCacheForTests();
    expect(await encryptedStorage.getItem(KEY)).toBe('v');
  });

  test('wipe still destroys the data key when removing values fails', async () => {
    await encryptedStorage.setItem(KEY, 'v');
    jest.spyOn(AsyncStorage, 'multiRemove').mockRejectedValueOnce(new Error('io'));
    await expect(wipeEncryptedLocalData()).rejects.toThrow('io');
    expect(await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME)).toBeNull();
  });
});
