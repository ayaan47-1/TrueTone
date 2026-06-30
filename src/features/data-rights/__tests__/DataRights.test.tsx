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
