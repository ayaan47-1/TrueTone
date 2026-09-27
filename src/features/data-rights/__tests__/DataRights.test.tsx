import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { DataRights } from '../DataRights';
const mockRpc = jest.fn().mockResolvedValue({ error: null });
jest.mock('../../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
const mockClearDiary = jest.fn(() => Promise.resolve());
jest.mock('../../diary/diary-storage', () => ({ clearDiary: () => mockClearDiary() }));

beforeEach(() => jest.clearAllMocks());

test('withdraw/delete/account call correct RPCs after confirm', async () => {
  const { getByTestId } = await render(<DataRights onChanged={jest.fn()} confirm={async () => true} />);
  await fireEvent.press(getByTestId('withdraw'));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('withdraw_consent'));
  await fireEvent.press(getByTestId('delete-data'));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('delete_my_data'));
  await fireEvent.press(getByTestId('delete-account'));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('delete_account'));
});

test('deleting data or the account also clears the on-device diary', async () => {
  const { getByTestId } = await render(<DataRights onChanged={jest.fn()} confirm={async () => true} />);
  await fireEvent.press(getByTestId('delete-data'));
  await waitFor(() => expect(mockClearDiary).toHaveBeenCalledTimes(1));
  await fireEvent.press(getByTestId('delete-account'));
  await waitFor(() => expect(mockClearDiary).toHaveBeenCalledTimes(2));
});

test('withdrawing consent does NOT clear the diary (no biometric data in it)', async () => {
  const { getByTestId } = await render(<DataRights onChanged={jest.fn()} confirm={async () => true} />);
  await fireEvent.press(getByTestId('withdraw'));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('withdraw_consent'));
  expect(mockClearDiary).not.toHaveBeenCalled();
});

test('a cancelled confirm clears nothing', async () => {
  const { getByTestId } = await render(<DataRights onChanged={jest.fn()} confirm={async () => false} />);
  await fireEvent.press(getByTestId('delete-data'));
  expect(mockRpc).not.toHaveBeenCalled();
  expect(mockClearDiary).not.toHaveBeenCalled();
});

describe('allergen profile purge (allergen P1)', () => {
  const SecureStore = require('expo-secure-store');
  const { saveAllergenProfile } = require('../../allergens/allergen-store');
  const { emptyProfile, toggleGroup } = require('../../allergens/profile');
  const KEY = 'truetone.allergens.u1.v1';

  test.each(['delete-data', 'delete-account'])('%s removes the on-device allergen profile key', async (id) => {
    await saveAllergenProfile('u1', toggleGroup(emptyProfile('yes', 't'), 'fragrance'));
    expect(SecureStore.__store.has(KEY)).toBe(true);
    const { getByTestId } = await render(<DataRights onChanged={jest.fn()} confirm={async () => true} />);
    await fireEvent.press(getByTestId(id));
    await waitFor(() => expect(SecureStore.__store.has(KEY)).toBe(false));
  });
});

describe('every local wipe runs on its own and failures are shown (code review H1)', () => {
  const SecureStore = require('expo-secure-store');
  const { saveAllergenProfile } = require('../../allergens/allergen-store');
  const { emptyProfile, toggleGroup } = require('../../allergens/profile');
  const flags = toggleGroup(emptyProfile('yes', 't'), 'fragrance');
  const FAILED = "Some data on this phone couldn't be removed. Please try again.";

  test.each(['delete-data', 'delete-account'])('%s: a Keychain failure still wipes the diary and shows an error', async (id) => {
    await saveAllergenProfile('u1', flags);
    SecureStore.getItemAsync.mockRejectedValueOnce(new Error('locked'));
    const onChanged = jest.fn();
    const v = await render(<DataRights userId="u1" onChanged={onChanged} confirm={async () => true} />);
    await fireEvent.press(v.getByTestId(id));
    await waitFor(() => expect(v.getByText(FAILED)).toBeTruthy());
    expect(mockClearDiary).toHaveBeenCalledTimes(1);
    expect(onChanged).not.toHaveBeenCalled();
  });

  test('a diary failure does not skip the allergen purge, and Try again finishes the wipe', async () => {
    await saveAllergenProfile('u1', flags);
    mockClearDiary.mockRejectedValueOnce(new Error('disk'));
    const onChanged = jest.fn();
    const v = await render(<DataRights userId="u1" onChanged={onChanged} confirm={async () => true} />);
    await fireEvent.press(v.getByTestId('delete-data'));
    await waitFor(() => expect(v.getByText(FAILED)).toBeTruthy());
    expect(SecureStore.__store.has('truetone.allergens.u1.v1')).toBe(false);
    await fireEvent.press(v.getByTestId('retry-local-wipe'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(v.queryByText(FAILED)).toBeNull();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  test('the signed-in user\'s profile is purged even if the index misses it', async () => {
    SecureStore.__store.set('truetone.allergens.u1.v1', JSON.stringify(flags));
    const v = await render(<DataRights userId="u1" onChanged={jest.fn()} confirm={async () => true} />);
    await fireEvent.press(v.getByTestId('delete-account'));
    await waitFor(() => expect(SecureStore.__store.has('truetone.allergens.u1.v1')).toBe(false));
  });
});
