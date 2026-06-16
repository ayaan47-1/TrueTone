import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { DataRights } from '../DataRights';
const mockRpc = jest.fn().mockResolvedValue({ error: null });
jest.mock('../../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
test('withdraw/delete/account call correct RPCs after confirm', async () => {
  const { getByTestId } = await render(<DataRights onChanged={jest.fn()} confirm={async () => true} />);
  await fireEvent.press(getByTestId('withdraw'));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('withdraw_consent'));
  await fireEvent.press(getByTestId('delete-data'));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('delete_my_data'));
  await fireEvent.press(getByTestId('delete-account'));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('delete_account'));
});
