import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  allergenKey, loadAllergenProfile, saveAllergenProfile, clearAllergenProfile, clearAllAllergenProfiles,
} from '../allergen-store';
import { emptyProfile, toggleGroup } from '../profile';

const SecureStore = require('expo-secure-store');
const flags = toggleGroup(emptyProfile('yes', '2026-09-27T00:00:00Z'), 'fragrance');

test('key is per user, same shape as routine-storage', () => {
  expect(allergenKey('u1')).toBe('truetone.allergens.u1.v1');
});

test('saves to the encrypted Keychain store (device-only), never to AsyncStorage', async () => {
  await saveAllergenProfile('u1', flags);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    'truetone.allergens.u1.v1', expect.any(String),
    expect.objectContaining({ keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' }),
  );
  expect(await AsyncStorage.getAllKeys()).not.toContain('truetone.allergens.u1.v1');
});

test('round-trips per user (survives a restart: a fresh load reads the stored profile)', async () => {
  await saveAllergenProfile('u1', flags);
  expect(await loadAllergenProfile('u1')).toEqual({ status: 'ok', profile: flags });
  expect(await loadAllergenProfile('u2')).toEqual({ status: 'ok', profile: null });
});

test('a storage read failure fails closed (design E17)', async () => {
  SecureStore.getItemAsync.mockRejectedValueOnce(new Error('keychain locked'));
  expect(await loadAllergenProfile('u1')).toEqual({ status: 'error' });
});

test('clearAllergenProfile removes the key', async () => {
  await saveAllergenProfile('u1', flags);
  await clearAllergenProfile('u1');
  expect(SecureStore.__store.has('truetone.allergens.u1.v1')).toBe(false);
});

test('clearAllAllergenProfiles removes every user\'s profile (delete-everything has no userId)', async () => {
  await saveAllergenProfile('u1', flags);
  await saveAllergenProfile('u2', flags);
  await clearAllAllergenProfiles();
  expect(SecureStore.__store.has('truetone.allergens.u1.v1')).toBe(false);
  expect(SecureStore.__store.has('truetone.allergens.u2.v1')).toBe(false);
  expect(SecureStore.__store.size).toBe(0);
});

test('rejects a userId that is not a safe key segment', async () => {
  await expect(saveAllergenProfile('../x', flags)).rejects.toThrow();
});

describe('fails closed on corrupt data (code review H3)', () => {
  test('a stored value that will not parse reads as an error, never as "no flags"', async () => {
    SecureStore.__store.set('truetone.allergens.u1.v1', '{not json');
    expect(await loadAllergenProfile('u1')).toEqual({ status: 'error' });
  });

  test('a stored value with an unknown version reads as an error', async () => {
    SecureStore.__store.set('truetone.allergens.u1.v1', JSON.stringify({ ...flags, version: 9 }));
    expect(await loadAllergenProfile('u1')).toEqual({ status: 'error' });
  });
});

describe('the index never misses a stored profile (code review H4)', () => {
  const KEY1 = 'truetone.allergens.u1.v1';
  const KEY2 = 'truetone.allergens.u2.v1';
  const INDEX = 'truetone.allergens.index.v1';

  test('the index is written before the profile, so a failed index write stores no profile', async () => {
    SecureStore.setItemAsync.mockImplementationOnce(async (k: string, v: string) => {
      if (k === INDEX) throw new Error('keychain');
      SecureStore.__store.set(k, v);
    });
    await expect(saveAllergenProfile('u1', flags)).rejects.toThrow();
    expect(SecureStore.__store.has(KEY1)).toBe(false);
  });

  test('a failed profile write after the index write still leaves the id purgeable', async () => {
    SecureStore.setItemAsync
      .mockImplementationOnce(async (k: string, v: string) => { SecureStore.__store.set(k, v); })
      .mockRejectedValueOnce(new Error('keychain'));
    await expect(saveAllergenProfile('u1', flags)).rejects.toThrow();
    await clearAllAllergenProfiles();
    expect(SecureStore.__store.size).toBe(0);
  });

  test('a corrupt index is never silently shrunk: saving fails and other users stay listed', async () => {
    await saveAllergenProfile('u2', flags);
    SecureStore.__store.set(INDEX, 'garbage');
    await expect(saveAllergenProfile('u1', flags)).rejects.toThrow();
    expect(SecureStore.__store.get(INDEX)).toBe('garbage');
    expect(SecureStore.__store.has(KEY1)).toBe(false);
  });

  test('delete-everything with a corrupt index still deletes the current user and reports the failure', async () => {
    await saveAllergenProfile('u1', flags);
    SecureStore.__store.set(INDEX, 'garbage');
    await expect(clearAllAllergenProfiles('u1')).rejects.toThrow();
    expect(SecureStore.__store.has(KEY1)).toBe(false);
  });

  test('delete-everything removes the current user even when the index misses them', async () => {
    SecureStore.__store.set(KEY1, JSON.stringify(flags));
    await clearAllAllergenProfiles('u1');
    expect(SecureStore.__store.has(KEY1)).toBe(false);
  });

  test('one failed delete does not skip the others, and the index is kept for a retry', async () => {
    await saveAllergenProfile('u1', flags);
    await saveAllergenProfile('u2', flags);
    SecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('locked'));
    await expect(clearAllAllergenProfiles()).rejects.toThrow();
    expect(SecureStore.__store.has(KEY2)).toBe(false);
    expect(SecureStore.__store.has(INDEX)).toBe(true);
    await clearAllAllergenProfiles();
    expect(SecureStore.__store.size).toBe(0);
  });

  test('clearAllergenProfile still succeeds when only the index cleanup fails (a stale id is harmless)', async () => {
    await saveAllergenProfile('u1', flags);
    SecureStore.__store.set(INDEX, 'garbage');
    await expect(clearAllergenProfile('u1')).resolves.toBeUndefined();
    expect(SecureStore.__store.has(KEY1)).toBe(false);
  });

  test('every Keychain call uses the device-only option (get, set and delete)', async () => {
    await saveAllergenProfile('u1', flags);
    await loadAllergenProfile('u1');
    await clearAllergenProfile('u1');
    const opts = expect.objectContaining({ keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' });
    for (const fn of [SecureStore.getItemAsync, SecureStore.setItemAsync, SecureStore.deleteItemAsync]) {
      for (const call of fn.mock.calls) expect(call[call.length - 1]).toEqual(opts);
    }
  });
});

test('clearAllergenProfile rejects when the Keychain delete itself fails (callers must handle it)', async () => {
  await saveAllergenProfile('u1', flags);
  SecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('locked'));
  await expect(clearAllergenProfile('u1')).rejects.toThrow('locked');
  expect(SecureStore.__store.has('truetone.allergens.u1.v1')).toBe(true);
});
