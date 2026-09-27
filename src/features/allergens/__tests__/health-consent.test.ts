const mockRpc = jest.fn();
jest.mock('../../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

import { recordHealthDataConsent, withdrawHealthDataConsent } from '../health-consent';
import { saveAllergenProfile, loadAllergenProfile } from '../allergen-store';
import { emptyProfile, toggleGroup } from '../profile';

beforeEach(() => mockRpc.mockReset());

test('record calls the wa_health RPC with no arguments (no flag data leaves the phone)', async () => {
  mockRpc.mockResolvedValue({ error: null });
  expect(await recordHealthDataConsent()).toBe(true);
  expect(mockRpc).toHaveBeenCalledWith('record_health_data_consent');
});

test('record reports failure so the caller saves nothing', async () => {
  mockRpc.mockResolvedValue({ error: { message: 'x' } });
  expect(await recordHealthDataConsent()).toBe(false);
  mockRpc.mockRejectedValue(new Error('offline'));
  expect(await recordHealthDataConsent()).toBe(false);
});

test('withdraw purges the on-device profile even if the RPC fails', async () => {
  await saveAllergenProfile('u1', toggleGroup(emptyProfile('yes', 't'), 'fragrance'));
  mockRpc.mockResolvedValue({ error: { message: 'offline' } });
  const out = await withdrawHealthDataConsent('u1');
  expect(out).toEqual({ cleared: true, logged: false });
  expect(await loadAllergenProfile('u1')).toEqual({ status: 'ok', profile: null });
  expect(mockRpc).toHaveBeenCalledWith('withdraw_health_data_consent');
});

test('a Keychain failure never skips the withdrawal receipt (code review H2)', async () => {
  const SecureStore = require('expo-secure-store');
  await saveAllergenProfile('u1', toggleGroup(emptyProfile('yes', 't'), 'fragrance'));
  mockRpc.mockResolvedValue({ error: null });
  SecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('locked'));
  expect(await withdrawHealthDataConsent('u1')).toEqual({ cleared: false, logged: true });
  expect(mockRpc).toHaveBeenCalledWith('withdraw_health_data_consent');
});

test('withdraw never rejects, even when both the purge and the RPC throw', async () => {
  const SecureStore = require('expo-secure-store');
  SecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('locked'));
  mockRpc.mockRejectedValue(new Error('offline'));
  expect(await withdrawHealthDataConsent('u1')).toEqual({ cleared: false, logged: false });
});
