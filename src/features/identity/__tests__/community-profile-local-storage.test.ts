import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLocalCommunityProfileRepository } from '../community-profile-repository';

jest.mock('../../../lib/supabase', () => ({ supabase: {} }));

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('the local community profile is encrypted at rest and reads back', async () => {
  const repo = createLocalCommunityProfileRepository();
  await repo.save({ userId: 'u1', username: 'maya', avatarUri: null });
  const raw = await AsyncStorage.getItem('truetone.community-profile.v1.u1');
  expect(raw).not.toContain('maya');
  expect(raw!.startsWith('enc1:')).toBe(true);
  expect(await repo.load('u1')).toEqual({ userId: 'u1', username: 'maya', avatarUri: null });
});

test('corrupt stored profile reads as no profile', async () => {
  await AsyncStorage.setItem('truetone.community-profile.v1.u1', 'enc1:deadbeef');
  expect(await createLocalCommunityProfileRepository().load('u1')).toBeNull();
});
