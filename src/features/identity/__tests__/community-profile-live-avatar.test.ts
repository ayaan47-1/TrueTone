// M1 (MASVS review + Dwight ruling): the device-local avatar path must never reach the server.
// The live repository keeps the photo URI in encrypted local storage only, writes avatar_uri = null,
// ignores any legacy path still on the server, and never writes avatar_uri at all: the column is
// scrubbed and client-locked by the profile_avatar_lock migration, and delete_my_data nulls it server-side.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { wipeEncryptedLocalData } from '../../../lib/encrypted-storage';
import * as repoModule from '../community-profile-repository';
import { createSupabaseCommunityProfileRepository, type ProfilesClient } from '../community-profile-repository';

jest.mock('../../../lib/supabase', () => ({ supabase: {} }));

const LOCAL_URI = 'file:///var/mobile/Containers/Data/Application/ABCD-1234/Library/Caches/truetone-avatar/avatar-1.jpg';

function fakeClient(row: { username: string | null; avatar_uri: string | null }) {
  const update = jest.fn((_values: Record<string, unknown>) => ({ eq: jest.fn(async () => ({ error: null })) }));
  const select = jest.fn((_columns: string) => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }));
  const client = { from: () => ({ select, update }) } as unknown as ProfilesClient;
  return { client, update, select };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('saving a profile never sends the device-local avatar path to the server', async () => {
  const { client, update } = fakeClient({ username: 'ada', avatar_uri: null });
  const repo = createSupabaseCommunityProfileRepository(client);
  const saved = await repo.save({ userId: 'u1', username: 'ada', avatarUri: LOCAL_URI });
  // Clients have no UPDATE privilege on avatar_uri after the lock migration: send username only.
  expect(update).toHaveBeenCalledWith({ username: 'ada' });
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

test('the stored avatar path is removed by the Delete My Data encrypted-storage wipe', async () => {
  const { client } = fakeClient({ username: 'ada', avatar_uri: null });
  const repo = createSupabaseCommunityProfileRepository(client);
  await repo.save({ userId: 'u1', username: 'ada', avatarUri: LOCAL_URI });
  await wipeEncryptedLocalData({ includeAuthSession: false });
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
  expect((await repo.load('u1'))?.avatarUri).toBeNull();
});

test('a legacy file path still on the server is ignored on load', async () => {
  const { client } = fakeClient({ username: 'ada', avatar_uri: 'file:///old/install/avatar.jpg' });
  const profile = await createSupabaseCommunityProfileRepository(client).load('u1');
  expect(profile).toEqual({ userId: 'u1', username: 'ada', avatarUri: null });
});

test('load never reads the server avatar column', async () => {
  const { client, select } = fakeClient({ username: 'ada', avatar_uri: null });
  await createSupabaseCommunityProfileRepository(client).load('u1');
  expect(select).toHaveBeenCalledWith('username');
});

test('the client-side server avatar clear is gone (delete_my_data clears it authoritatively)', () => {
  expect('clearServerAvatarUri' in repoModule).toBe(false);
});
