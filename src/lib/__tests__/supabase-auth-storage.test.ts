import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  AUTH_SESSION_ENCRYPTION_KEY_NAME,
  __resetKeyCacheForTests,
  encryptedStorage,
} from '../encrypted-storage';
import { supabaseAuthStorage } from '../supabase-auth-storage';

const AUTH_KEY = 'sb-tskbebqnlginnjhxpsnp-auth-token';
const SESSION = JSON.stringify({ access_token: 'access', refresh_token: 'refresh' });

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetKeyCacheForTests();
});

test('adapter round-trips and removes a session without storing plaintext', async () => {
  await supabaseAuthStorage.setItem(AUTH_KEY, SESSION);

  expect(await supabaseAuthStorage.getItem(AUTH_KEY)).toBe(SESSION);
  expect(await AsyncStorage.getItem(AUTH_KEY)).not.toContain('refresh');
  expect(await SecureStore.getItemAsync(AUTH_SESSION_ENCRYPTION_KEY_NAME)).not.toBeNull();

  await supabaseAuthStorage.removeItem(AUTH_KEY);
  expect(await supabaseAuthStorage.getItem(AUTH_KEY)).toBeNull();
});

test('first read migrates a plaintext session without changing its identity', async () => {
  await AsyncStorage.setItem(AUTH_KEY, SESSION);

  const migrated = await supabaseAuthStorage.getItem(AUTH_KEY);

  expect(migrated).toBe(SESSION);
  expect(JSON.parse(migrated!).refresh_token).toBe('refresh');
  expect((await AsyncStorage.getItem(AUTH_KEY))?.startsWith('enc1:')).toBe(true);
});

test('corrupt session data reads as signed out instead of throwing', async () => {
  await supabaseAuthStorage.setItem(AUTH_KEY, SESSION);
  await AsyncStorage.setItem(AUTH_KEY, 'enc1:not-valid-ciphertext');

  await expect(supabaseAuthStorage.getItem(AUTH_KEY)).resolves.toBeNull();
});

test('an unreadable keychain reads as signed out instead of throwing into supabase-js', async () => {
  await supabaseAuthStorage.setItem(AUTH_KEY, SESSION);
  __resetKeyCacheForTests();
  (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('device locked'));

  await expect(supabaseAuthStorage.getItem(AUTH_KEY)).resolves.toBeNull();
});

test('write and remove failures reject instead of falsely reporting the session persisted or cleared', async () => {
  const write = jest.spyOn(encryptedStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
  const remove = jest.spyOn(encryptedStorage, 'removeItem').mockRejectedValueOnce(new Error('locked'));

  await expect(supabaseAuthStorage.setItem(AUTH_KEY, SESSION)).rejects.toThrow('disk full');
  await expect(supabaseAuthStorage.removeItem(AUTH_KEY)).rejects.toThrow('locked');

  write.mockRestore();
  remove.mockRestore();
});
