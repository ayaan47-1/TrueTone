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
