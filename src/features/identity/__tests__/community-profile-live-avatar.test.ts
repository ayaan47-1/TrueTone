// M1 (MASVS review + Dwight ruling): the device-local avatar path must never reach the server.
// The live repository keeps the photo URI in encrypted local storage only, writes avatar_uri = null,
// ignores any legacy path still on the server, and Delete My Data clears the server column.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearServerAvatarUri,
  createSupabaseCommunityProfileRepository,
  type ProfilesClient,
} from '../community-profile-repository';

jest.mock('../../../lib/supabase', () => ({ supabase: {} }));

const LOCAL_URI = 'file:///var/mobile/Containers/Data/Application/ABCD-1234/Library/Caches/truetone-avatar/avatar-1.jpg';

function fakeClient(row: { username: string | null; avatar_uri: string | null }) {
  const update = jest.fn((_values: Record<string, unknown>) => ({ eq: jest.fn(async () => ({ error: null })) }));
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }),
      update,
    }),
  } as unknown as ProfilesClient;
  return { client, update };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('saving a profile never sends the device-local avatar path to the server', async () => {
  const { client, update } = fakeClient({ username: 'ada', avatar_uri: null });
  const repo = createSupabaseCommunityProfileRepository(client);
  const saved = await repo.save({ userId: 'u1', username: 'ada', avatarUri: LOCAL_URI });
  expect(update).toHaveBeenCalledWith({ username: 'ada', avatar_uri: null });
  expect(JSON.stringify(update.mock.calls)).not.toContain('file://');
  expect(saved.avatarUri).toBe(LOCAL_URI);
});

test('the avatar path is kept only in encrypted on-device storage and reads back', async () => {
  const { client } = fakeClient({ username: 'ada', avatar_uri: null });
  const repo = createSupabaseCommunityProfileRepository(client);
  await repo.save({ userId: 'u1', username: 'ada', avatarUri: LOCAL_URI });
  const stored = Object.values(Object.fromEntries(await AsyncStorage.multiGet(await AsyncStorage.getAllKeys())));
  expect(stored.join('\n')).not.toContain('file://');
  expect((await repo.load('u1'))?.avatarUri).toBe(LOCAL_URI);
});

test('a legacy file path still on the server is ignored on load', async () => {
  const { client } = fakeClient({ username: 'ada', avatar_uri: 'file:///old/install/avatar.jpg' });
  const profile = await createSupabaseCommunityProfileRepository(client).load('u1');
  expect(profile).toEqual({ userId: 'u1', username: 'ada', avatarUri: null });
});

describe('clearServerAvatarUri (Delete My Data)', () => {
  function serverClient(opts: { uid?: string | null; error?: unknown }) {
    const eq = jest.fn(async () => ({ error: opts.error ?? null }));
    const update = jest.fn(() => ({ eq }));
    const client = {
      auth: { getSession: async () => ({ data: { session: opts.uid ? { user: { id: opts.uid } } : null } }) },
      from: () => ({ update }),
    };
    return { client, update, eq };
  }

  test('sets profiles.avatar_uri to null for the signed-in user', async () => {
    const { client, update, eq } = serverClient({ uid: 'u1' });
    await clearServerAvatarUri(client);
    expect(update).toHaveBeenCalledWith({ avatar_uri: null });
    expect(eq).toHaveBeenCalledWith('id', 'u1');
  });

  test('rejects when the server clear fails so the caller can surface a retry', async () => {
    const { client } = serverClient({ uid: 'u1', error: { message: 'offline' } });
    await expect(clearServerAvatarUri(client)).rejects.toBeTruthy();
  });

  test('rejects when there is no session (cannot prove the column was cleared)', async () => {
    const { client } = serverClient({ uid: null });
    await expect(clearServerAvatarUri(client)).rejects.toThrow();
  });
});
