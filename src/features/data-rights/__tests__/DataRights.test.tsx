import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { DataRights } from '../DataRights';
import { encryptedStorage, ENCRYPTION_KEY_NAME } from '../../../lib/encrypted-storage';
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
