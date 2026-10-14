import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { DataRights } from '../DataRights';
import { encryptedStorage, ENCRYPTION_KEY_NAME } from '../../../lib/encrypted-storage';
import { supabaseAuthStorage } from '../../../lib/supabase-auth-storage';

const AUTH_KEY = 'sb-project-auth-token';
const SESSION = JSON.stringify({ access_token: 'access', refresh_token: 'refresh' });
const mockRpc = jest.fn().mockResolvedValue({ error: null });
const mockSignOut = jest.fn().mockResolvedValue({ error: null });
jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), auth: { signOut: (...a: unknown[]) => mockSignOut(...a) } },
}));
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

test('withdraws AI consent independently without withdrawing scan consent', async () => {
  const { getByTestId } = await render(<DataRights onChanged={jest.fn()} confirm={async () => true} />);
  await fireEvent.press(getByTestId('withdraw-ai'));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('withdraw_ai_consent'));
  expect(mockRpc).not.toHaveBeenCalledWith('withdraw_consent');
  expect(mockClearDiary).not.toHaveBeenCalled();
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

test('deleting data also clears the on-device order history used for routine suggestions', async () => {
  const { orderHistory } = jest.requireActual('../../checkout/order-history-store');
  orderHistory.record(['p1']);
  const { getByTestId } = await render(<DataRights onChanged={jest.fn()} confirm={async () => true} />);
  await fireEvent.press(getByTestId('delete-data'));
  await waitFor(() => expect(orderHistory.purchasedIds()).toEqual([]));
});

test('deleting data removes the stored order history from the device', async () => {
  const { orderHistory, ORDER_HISTORY_KEY } = jest.requireActual('../../checkout/order-history-store');
  await orderHistory.record(['p1']);
  expect(await AsyncStorage.getItem(ORDER_HISTORY_KEY)).not.toBeNull();
  const { getByTestId } = await render(<DataRights onChanged={jest.fn()} confirm={async () => true} />);
  await fireEvent.press(getByTestId('delete-data'));
  await waitFor(async () => expect(await AsyncStorage.getItem(ORDER_HISTORY_KEY)).toBeNull());
});

test('deleting data wipes every encrypted on-device store and destroys the data key', async () => {
  await encryptedStorage.setItem('truetone.community-profile.v1.u1', '{"username":"maya"}');
  await encryptedStorage.setItem('age-gate:verified:u1', '{"userId":"u1"}');
  expect(await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME)).not.toBeNull();
  const { getByTestId } = await render(<DataRights onChanged={jest.fn()} confirm={async () => true} />);
  await fireEvent.press(getByTestId('delete-data'));
  await waitFor(async () => expect(await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME)).toBeNull());
  expect(await AsyncStorage.getItem('truetone.community-profile.v1.u1')).toBeNull();
  expect(await AsyncStorage.getItem('age-gate:verified:u1')).toBeNull();
});

test('a failed order-history wipe does not stop the rest of delete-everything', async () => {
  const { orderHistory } = jest.requireActual('../../checkout/order-history-store');
  const spy = jest.spyOn(orderHistory, 'clear').mockRejectedValueOnce(new Error('locked'));
  await encryptedStorage.setItem('age-gate:verified:u1', '{"userId":"u1"}');
  const { getByTestId } = await render(<DataRights onChanged={jest.fn()} confirm={async () => true} />);
  await fireEvent.press(getByTestId('delete-data'));
  await waitFor(() => expect(mockClearDiary).toHaveBeenCalled());
  await waitFor(async () => expect(await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME)).toBeNull());
  spy.mockRestore();
});

test('deleting the account signs out locally before refreshing (the deleted user’s token must not be reused)', async () => {
  const order: string[] = [];
  mockSignOut.mockImplementationOnce(async () => { order.push('signOut'); return { error: null }; });
  const onChanged = jest.fn(() => { order.push('onChanged'); });
  const { getByTestId } = await render(<DataRights onChanged={onChanged} confirm={async () => true} />);
  await fireEvent.press(getByTestId('delete-account'));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(order).toEqual(['signOut', 'onChanged']);
});

test('withdrawing consent or deleting data keeps the session', async () => {
  await supabaseAuthStorage.setItem(AUTH_KEY, SESSION);
  const onChanged = jest.fn();
  const { getByTestId } = await render(<DataRights onChanged={onChanged} confirm={async () => true} />);
  await fireEvent.press(getByTestId('withdraw'));
  await fireEvent.press(getByTestId('delete-data'));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2));
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(await supabaseAuthStorage.getItem(AUTH_KEY)).toBe(SESSION);
});

test('deleting the account wipes the encrypted auth session even if sign-out does not', async () => {
  await supabaseAuthStorage.setItem(AUTH_KEY, SESSION);
  const onChanged = jest.fn();
  const { getByTestId } = await render(<DataRights onChanged={onChanged} confirm={async () => true} />);

  await fireEvent.press(getByTestId('delete-account'));

  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  expect(await supabaseAuthStorage.getItem(AUTH_KEY)).toBeNull();
});

test('a failed sign-out after account deletion still wipes on-device data and refreshes', async () => {
  mockSignOut.mockRejectedValueOnce(new Error('storage unavailable'));
  const onChanged = jest.fn();
  const { getByTestId } = await render(<DataRights onChanged={onChanged} confirm={async () => true} />);
  await fireEvent.press(getByTestId('delete-account'));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  expect(mockClearDiary).toHaveBeenCalledTimes(1);
});

test('a failed local wipe still runs the other wipes, reports deletion incomplete and does not report success', async () => {
  const { orderHistory, ORDER_HISTORY_KEY } = jest.requireActual('../../checkout/order-history-store');
  await orderHistory.record(['p1']);
  mockClearDiary.mockRejectedValueOnce(new Error('disk full'));
  const onChanged = jest.fn();
  const { getByTestId, findByText } = await render(<DataRights onChanged={onChanged} confirm={async () => true} />);
  await fireEvent.press(getByTestId('delete-data'));
  await findByText(/deletion incomplete/i);
  expect(await AsyncStorage.getItem(ORDER_HISTORY_KEY)).toBeNull();
  expect(onChanged).not.toHaveBeenCalled();
});

test('retrying an incomplete deletion re-runs the on-device wipes and reports success once they all clear', async () => {
  mockClearDiary.mockRejectedValueOnce(new Error('disk full'));
  const onChanged = jest.fn();
  const { getByTestId, findByText, queryByText } = await render(<DataRights onChanged={onChanged} confirm={async () => true} />);
  await fireEvent.press(getByTestId('delete-data'));
  await findByText(/deletion incomplete/i);
  expect(mockRpc).toHaveBeenCalledTimes(1);
  await fireEvent.press(getByTestId('retry-wipe'));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  expect(mockClearDiary).toHaveBeenCalledTimes(2);
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(queryByText(/deletion incomplete/i)).toBeNull();
});

test('a rejecting order-history clear is not swallowed as success', async () => {
  const { orderHistory } = jest.requireActual('../../checkout/order-history-store');
  const spy = jest.spyOn(orderHistory, 'clear').mockRejectedValueOnce(new Error('io'));
  const onChanged = jest.fn();
  const { getByTestId, findByText } = await render(<DataRights onChanged={onChanged} confirm={async () => true} />);
  await fireEvent.press(getByTestId('delete-account'));
  await findByText(/deletion incomplete/i);
  expect(mockClearDiary).toHaveBeenCalledTimes(1);
  expect(onChanged).not.toHaveBeenCalled();
  spy.mockRestore();
});

test('retrying an incomplete deletion is single-flight: a double tap runs the wipes once', async () => {
  mockClearDiary.mockRejectedValueOnce(new Error('disk full'));
  const onChanged = jest.fn();
  const { getByTestId, findByText } = await render(<DataRights onChanged={onChanged} confirm={async () => true} />);
  await fireEvent.press(getByTestId('delete-data'));
  await findByText(/deletion incomplete/i);
  let finish: () => void = () => {};
  mockClearDiary.mockImplementationOnce(() => new Promise<void>((r) => { finish = r; }));
  const retry = getByTestId('retry-wipe');
  fireEvent.press(retry);
  fireEvent.press(retry);
  finish();
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  expect(mockClearDiary).toHaveBeenCalledTimes(2);
});
