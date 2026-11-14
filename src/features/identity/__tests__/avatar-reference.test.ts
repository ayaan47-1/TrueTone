import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptedStorage } from '../../../lib/encrypted-storage';
import { createLocalCommunityProfileRepository, createSupabaseCommunityProfileRepository } from '../community-profile-repository';
import type { ProfilesClient } from '../community-profile-repository';

jest.mock('../../../lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }));
import { getInfoAsync } from 'expo-file-system/legacy';

const oldUri = 'file:///cache/truetone-avatar/avatar-1.jpg';
const newUri = 'file:///cache/truetone-avatar/avatar-2.jpg';
const profile = { userId: 'u1', username: 'ada', avatarUri: oldUri };
const update = jest.fn(() => ({ eq: async () => ({ error: null }) }));
const client: ProfilesClient = { from: () => ({
  select: () => ({ eq: () => ({ single: async () => ({ data: { username: 'ada' }, error: null }) }) }),
  update,
}) };

beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); });

describe.each(['local', 'live'] as const)('%s avatar reference', (mode) => {
  const key = mode === 'local' ? 'truetone.community-profile.v1.u1' : 'truetone.community-profile.avatar.v1.u1';
  const repository = () => mode === 'local'
    ? createLocalCommunityProfileRepository() : createSupabaseCommunityProfileRepository(client);

  test('confirmed cache eviction clears only the photo reference and keeps the username', async () => {
    const repo = repository();
    await repo.save(profile);
    update.mockClear();
    jest.mocked(getInfoAsync).mockResolvedValue({ exists: false, uri: oldUri, isDirectory: false });
    expect(await repo.load('u1')).toEqual({ ...profile, avatarUri: null });
    const raw = await encryptedStorage.getItem(key);
    expect(mode === 'local' ? JSON.parse(raw ?? '{}') : raw).toEqual(mode === 'local' ? { ...profile, avatarUri: null } : null);
    expect(update).not.toHaveBeenCalled();
  });

  test('an unreadable file check preserves the reference', async () => {
    const repo = repository();
    await repo.save(profile);
    jest.mocked(getInfoAsync).mockRejectedValue(new Error('temporarily unavailable'));
    expect(await repo.load('u1')).toEqual(profile);
    expect(await encryptedStorage.getItem(key)).toContain(oldUri);
  });

  test('an existing file remains selected', async () => {
    const repo = repository();
    await repo.save(profile);
    jest.mocked(getInfoAsync).mockResolvedValue({ exists: true, uri: oldUri, isDirectory: false,
      size: 100, modificationTime: 1 });
    expect(await repo.load('u1')).toEqual(profile);
    expect(await encryptedStorage.getItem(key)).toContain(oldUri);
  });

  test('a failed cleanup write keeps the username and retries next load', async () => {
    const repo = repository();
    await repo.save(profile);
    jest.mocked(getInfoAsync).mockResolvedValue({ exists: false, uri: oldUri, isDirectory: false });
    jest.spyOn(encryptedStorage, 'replaceIfUnchanged').mockRejectedValueOnce(new Error('storage locked'));
    expect(await repo.load('u1')).toEqual(profile);
    expect(await repo.load('u1')).toEqual({ ...profile, avatarUri: null });
    jest.restoreAllMocks();
  });

  test('an old missing-file check cannot erase a newly selected avatar', async () => {
    const repo = repository();
    await repo.save(profile);
    jest.mocked(getInfoAsync).mockImplementationOnce(async () => {
      await repo.save({ ...profile, username: 'ada-new', avatarUri: newUri });
      return { exists: false, uri: oldUri, isDirectory: false };
    });
    await repo.load('u1');
    expect(await encryptedStorage.getItem(key)).toContain(newUri);
  });
});
