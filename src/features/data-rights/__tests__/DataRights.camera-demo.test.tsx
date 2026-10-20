import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { DataRights } from '../DataRights';
import { cameraDemoSetConsent, cameraDemoSetIs18, cameraDemoState } from '../../../lib/camera-demo-profile';

// Camera build (Dwight FAIL on PR #60): Your Data acts on this device only, never the server.
const mockRpc = jest.fn();
const mockSignOut = jest.fn();
const mockClearScans = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  SUPABASE_OFFLINE: true,
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), auth: { signOut: (...a: unknown[]) => mockSignOut(...a) } },
}));
jest.mock('../../../lib/scans', () => ({ clearCameraDemoScans: () => mockClearScans() }));
const mockClearDiary = jest.fn(() => Promise.resolve());
jest.mock('../../diary/diary-storage', () => ({ clearDiary: () => mockClearDiary() }));

beforeEach(() => {
  jest.clearAllMocks();
  cameraDemoSetIs18();
  cameraDemoSetConsent();
});

test('withdraw clears the local consent flag only, no RPC', async () => {
  const onChanged = jest.fn();
  const { getByTestId } = await render(<DataRights onChanged={onChanged} confirm={async () => true} />);
  await fireEvent.press(getByTestId('withdraw'));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  expect(cameraDemoState()).toEqual({ is18: true, consentActive: false });
  expect(mockClearScans).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalled();
});

test('delete data wipes on-device scans and stores, no RPC', async () => {
  const onChanged = jest.fn();
  const { getByTestId } = await render(<DataRights onChanged={onChanged} confirm={async () => true} />);
  await fireEvent.press(getByTestId('delete-data'));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  expect(mockClearScans).toHaveBeenCalledTimes(1);
  expect(mockClearDiary).toHaveBeenCalledTimes(1);
  expect(mockRpc).not.toHaveBeenCalled();
});

test('delete account also resets the local age and consent gates, no RPC or sign-out', async () => {
  const onChanged = jest.fn();
  const { getByTestId } = await render(<DataRights onChanged={onChanged} confirm={async () => true} />);
  await fireEvent.press(getByTestId('delete-account'));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  expect(cameraDemoState()).toEqual({ is18: false, consentActive: false });
  expect(mockClearScans).toHaveBeenCalledTimes(1);
  expect(mockRpc).not.toHaveBeenCalled();
  expect(mockSignOut).not.toHaveBeenCalled();
});
