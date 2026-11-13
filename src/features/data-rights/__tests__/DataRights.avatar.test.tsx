import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { DataRights } from '../DataRights';

const mockRpc = jest.fn().mockResolvedValue({ error: null });
jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), auth: { signOut: jest.fn().mockResolvedValue({ error: null }) } },
}));
jest.mock('../../diary/diary-storage', () => ({ clearDiary: () => Promise.resolve() }));
const mockAvatarWipe = jest.fn(() => Promise.resolve());
jest.mock('../../identity/avatar-file', () => ({ avatarFileStore: () => ({ wipe: () => mockAvatarWipe() }) }));
const mockClearServerAvatar = jest.fn(() => Promise.resolve());
jest.mock('../../identity/community-profile-repository', () => ({
  clearServerAvatarUri: () => mockClearServerAvatar(),
}));

beforeEach(() => jest.clearAllMocks());

// MASVS M1: the profile photo file and the server avatar path are part of "delete everything".
describe('profile photo (MASVS M1)', () => {
  test('Delete My Data deletes the local photo file and clears the server avatar path', async () => {
    const onChanged = jest.fn();
    const view = await render(<DataRights onChanged={onChanged} confirm={async () => true} />);
    await fireEvent.press(view.getByTestId('delete-data'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(mockAvatarWipe).toHaveBeenCalledTimes(1);
    expect(mockClearServerAvatar).toHaveBeenCalledTimes(1);
  });

  test('Delete Account deletes the local photo file (the profile row goes with the account)', async () => {
    const onChanged = jest.fn();
    const view = await render(<DataRights onChanged={onChanged} confirm={async () => true} />);
    await fireEvent.press(view.getByTestId('delete-account'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(mockAvatarWipe).toHaveBeenCalledTimes(1);
  });

  test('a failed photo delete reports deletion incomplete, and retry finishes it', async () => {
    mockAvatarWipe.mockRejectedValueOnce(new Error('locked'));
    const onChanged = jest.fn();
    const view = await render(<DataRights onChanged={onChanged} confirm={async () => true} />);
    await fireEvent.press(view.getByTestId('delete-data'));
    await waitFor(() => expect(view.getByText('Deletion incomplete')).toBeTruthy());
    expect(onChanged).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('retry-wipe'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(mockAvatarWipe).toHaveBeenCalledTimes(2);
  });

  test('a failed server avatar clear still wipes the device, reports incomplete, and retry re-runs the clear', async () => {
    mockClearServerAvatar.mockRejectedValueOnce(new Error('offline'));
    const onChanged = jest.fn();
    const view = await render(<DataRights onChanged={onChanged} confirm={async () => true} />);
    await fireEvent.press(view.getByTestId('delete-data'));
    await waitFor(() => expect(view.getByText('Deletion incomplete')).toBeTruthy());
    expect(mockAvatarWipe).toHaveBeenCalledTimes(1);
    expect(onChanged).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('retry-wipe'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(mockClearServerAvatar).toHaveBeenCalledTimes(2);
  });
});
