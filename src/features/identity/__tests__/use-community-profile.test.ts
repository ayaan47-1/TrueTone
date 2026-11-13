import { renderHook, act } from '@testing-library/react-native';
import { useCommunityProfile } from '../use-community-profile';
import type { CommunityProfile } from '../community-profile-types';
import type { CommunityProfileRepository } from '../community-profile-repository';
import type { AvatarFileStore } from '../avatar-file';

const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    mockRequestMediaLibraryPermissionsAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

function fakeRepository(initial: CommunityProfile | null): CommunityProfileRepository {
  let stored = initial;
  return {
    load: jest.fn(async () => stored),
    save: jest.fn(async (profile: CommunityProfile) => {
      stored = profile;
      return profile;
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
  mockLaunchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///tmp/picked-avatar.jpg' }],
  });
});

test('loads the existing profile for a signed-in user', async () => {
  const repo = fakeRepository({ userId: 'u1', username: 'ada', avatarUri: null });
  const { result } = await renderHook(() => useCommunityProfile('u1', repo));
  expect(repo.load).toHaveBeenCalledWith('u1');
  expect(result.current.loading).toBe(false);
  expect(result.current.profile).toEqual({ userId: 'u1', username: 'ada', avatarUri: null });
});

test('does not load when there is no signed-in user', async () => {
  const repo = fakeRepository(null);
  const { result } = await renderHook(() => useCommunityProfile(null, repo));
  expect(repo.load).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);
  expect(result.current.profile).toBeNull();
});

test('rejects an invalid username before ever calling save', async () => {
  const repo = fakeRepository(null);
  const { result } = await renderHook(() => useCommunityProfile('u1', repo));

  let outcome;
  await act(async () => {
    outcome = await result.current.saveUsername('AB');
  });

  expect(outcome).toEqual({ ok: false, error: expect.stringContaining('at least') });
  expect(repo.save).not.toHaveBeenCalled();
});

test('saves a normalized username and keeps any existing avatar', async () => {
  const repo = fakeRepository({ userId: 'u1', username: 'oldname', avatarUri: 'file:///old.jpg' });
  const { result } = await renderHook(() => useCommunityProfile('u1', repo));

  let outcome;
  await act(async () => {
    outcome = await result.current.saveUsername('  NewName  ');
  });

  expect(outcome).toEqual({ ok: true });
  expect(repo.save).toHaveBeenCalledWith({
    userId: 'u1',
    username: 'newname',
    avatarUri: 'file:///old.jpg',
  });
  expect(result.current.profile?.username).toBe('newname');
});

test('a unique-violation from the repository surfaces as "That username is taken."', async () => {
  const repo = fakeRepository(null);
  (repo.save as jest.Mock).mockRejectedValue({ code: '23505' });
  const { result } = await renderHook(() => useCommunityProfile('u1', repo));

  let outcome;
  await act(async () => {
    outcome = await result.current.saveUsername('takenname');
  });

  expect(outcome).toEqual({ ok: false, error: 'That username is taken.' });
});

test('pickAvatar does nothing until a username/profile already exists', async () => {
  const repo = fakeRepository(null);
  const { result } = await renderHook(() => useCommunityProfile('u1', repo));

  await act(async () => {
    await result.current.pickAvatar();
  });

  expect(mockLaunchImageLibraryAsync).not.toHaveBeenCalled();
  expect(repo.save).not.toHaveBeenCalled();
});

function fakeAvatarFiles(cleanupComplete = true): AvatarFileStore {
  return {
    adopt: jest.fn(async () => ({ uri: 'file:///cache/truetone-avatar/avatar-1.jpg', cleanupComplete })),
    wipe: jest.fn(async () => undefined),
    isManaged: jest.fn(() => true),
  };
}

test('pickAvatar adopts the picked image into app-owned storage and saves only the managed copy', async () => {
  const repo = fakeRepository({ userId: 'u1', username: 'ada', avatarUri: null });
  const files = fakeAvatarFiles();
  const { result } = await renderHook(() => useCommunityProfile('u1', repo, files));

  await act(async () => {
    await result.current.pickAvatar();
  });

  expect(files.adopt).toHaveBeenCalledWith('file:///tmp/picked-avatar.jpg');
  expect(repo.save).toHaveBeenCalledWith({
    userId: 'u1',
    username: 'ada',
    avatarUri: 'file:///cache/truetone-avatar/avatar-1.jpg',
  });
  expect(result.current.profile?.avatarUri).toBe('file:///cache/truetone-avatar/avatar-1.jpg');
  expect(result.current.avatarStatus).toBe('idle');
});

test('pickAvatar surfaces an incomplete cleanup of the replaced photo instead of hiding it', async () => {
  const repo = fakeRepository({ userId: 'u1', username: 'ada', avatarUri: 'file:///cache/truetone-avatar/avatar-0.jpg' });
  const files = fakeAvatarFiles(false);
  const { result } = await renderHook(() => useCommunityProfile('u1', repo, files));

  await act(async () => {
    await result.current.pickAvatar();
  });

  expect(result.current.profile?.avatarUri).toBe('file:///cache/truetone-avatar/avatar-1.jpg');
  expect(result.current.avatarStatus).toBe('cleanup-incomplete');
});

test('a failed adoption saves nothing and reports an error', async () => {
  const repo = fakeRepository({ userId: 'u1', username: 'ada', avatarUri: null });
  const files = fakeAvatarFiles();
  (files.adopt as jest.Mock).mockRejectedValue(new Error('disk full'));
  const { result } = await renderHook(() => useCommunityProfile('u1', repo, files));

  await act(async () => {
    await result.current.pickAvatar();
  });

  expect(repo.save).not.toHaveBeenCalled();
  expect(result.current.avatarStatus).toBe('error');
});

test('pickAvatar surfaces "unavailable" without touching the picker when permission is denied', async () => {
  mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });
  const repo = fakeRepository({ userId: 'u1', username: 'ada', avatarUri: null });
  const { result } = await renderHook(() => useCommunityProfile('u1', repo));

  await act(async () => {
    await result.current.pickAvatar();
  });

  expect(mockLaunchImageLibraryAsync).not.toHaveBeenCalled();
  expect(repo.save).not.toHaveBeenCalled();
  expect(result.current.avatarStatus).toBe('unavailable');
});

test('a cancelled picker leaves the profile untouched', async () => {
  mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
  const repo = fakeRepository({ userId: 'u1', username: 'ada', avatarUri: null });
  const { result } = await renderHook(() => useCommunityProfile('u1', repo));

  await act(async () => {
    await result.current.pickAvatar();
  });

  expect(repo.save).not.toHaveBeenCalled();
  expect(result.current.avatarStatus).toBe('idle');
});

test('a save failure during avatar pick resolves without throwing', async () => {
  const repo = fakeRepository({ userId: 'u1', username: 'ada', avatarUri: null });
  (repo.save as jest.Mock).mockRejectedValue(new Error('network error'));
  const { result } = await renderHook(() => useCommunityProfile('u1', repo, fakeAvatarFiles()));

  await act(async () => {
    await result.current.pickAvatar();
  });

  expect(result.current.avatarStatus).toBe('error');
});
