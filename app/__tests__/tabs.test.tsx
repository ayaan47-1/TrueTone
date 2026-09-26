import { render, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  // Run the focus effect once on mount (real useFocusEffect fires on focus, not
  // every render — running it per-render would loop when the callback sets state).
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

jest.mock('../../src/lib/scans', () => ({ fetchScanHistory: jest.fn(() => Promise.resolve([])) }));
jest.mock('../../src/features/diary/diary-storage', () => ({
  getMood: jest.fn(() => Promise.resolve(null)),
  setMood: jest.fn(() => Promise.resolve()),
}));

// You (Account) needs a signed-in userId from the app-wide profile context; the real
// provider does a network/session bootstrap this suite has no business exercising.
jest.mock('../../src/lib/profile-context', () => ({
  useProfile: () => ({ userId: 'test-user', loading: false, error: false, route: 'home', refresh: jest.fn() }),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// useCommunityProfile's own load/save/pickAvatar logic is covered directly in
// src/features/identity/__tests__/use-community-profile.test.ts; here we only need to
// drive the states the You screen renders differently for.
const mockSaveUsername = jest.fn();
const mockPickAvatar = jest.fn();
let mockCommunityProfile: {
  profile: { userId: string; username: string; avatarUri: string | null } | null;
  loading: boolean;
  saveUsername: typeof mockSaveUsername;
  pickAvatar: typeof mockPickAvatar;
  avatarStatus: 'idle' | 'picking' | 'unavailable' | 'error';
};
jest.mock('../../src/features/identity/use-community-profile', () => ({
  useCommunityProfile: () => mockCommunityProfile,
}));

import TodayScreen from '../(tabs)/index';
import YouScreen from '../(tabs)/you';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  jest.clearAllMocks();
  mockCommunityProfile = {
    profile: { userId: 'test-user', username: 'ada', avatarUri: null },
    loading: false,
    saveUsername: mockSaveUsername,
    pickAvatar: mockPickAvatar,
    avatarStatus: 'idle',
  };
  mockSaveUsername.mockResolvedValue({ ok: true });
});

test('For You shows the disclaimer and the shade-match icon opens the scan gate, never the camera', async () => {
  const view = await render(<TodayScreen />);
  expect(view.getByText(/not a medical device/i)).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Shade match' }));
  // MUST be /scan-gate (the pre-camera privacy screen), never /scan directly — a hard
  // compliance rule (app/_layout.tsx's Guard also structurally blocks /scan in DEMO_MODE).
  expect(mockPush).toHaveBeenCalledWith('/scan-gate');
  expect(mockPush).not.toHaveBeenCalledWith('/scan');
  await flush();
});

// The Trend tab was removed in commerce-navigation tasks 08-09 (Community replaces it);
// its screen and test are gone. Tab layout is covered by app/__tests__/tabs-layout.test.tsx.

test('You surfaces the data-rights and policies routes', async () => {
  const view = await render(<YouScreen />);
  fireEvent.press(view.getByRole('button', { name: 'Your Data' }));
  expect(mockPush).toHaveBeenCalledWith('/data');
  await flush();
  fireEvent.press(view.getByRole('button', { name: 'Privacy & Policies' }));
  expect(mockPush).toHaveBeenCalledWith('/policies');
  await flush();
});

test('You pre-fills the existing username and saves an edit', async () => {
  const view = await render(<YouScreen />);
  const input = view.getByTestId('username-input');
  expect(input.props.value).toBe('ada');

  await fireEvent.changeText(input, 'newname');
  await fireEvent.press(view.getByText('Save username'));
  await flush();

  expect(mockSaveUsername).toHaveBeenCalledWith('newname');
});

test('You shows the save error inline when the username is taken', async () => {
  mockSaveUsername.mockResolvedValue({ ok: false, error: 'That username is taken.' });
  const view = await render(<YouScreen />);

  await fireEvent.changeText(view.getByTestId('username-input'), 'taken');
  await fireEvent.press(view.getByText('Save username'));
  await flush();

  expect(view.getByText('That username is taken.')).toBeTruthy();
});

test('You offers "Create username" (not "Save") and disables the avatar picker before a profile exists', async () => {
  mockCommunityProfile.profile = null;
  const view = await render(<YouScreen />);

  expect(view.getByText('Create username')).toBeTruthy();
  await fireEvent.press(view.getByTestId('avatar-picker'));
  expect(mockPickAvatar).not.toHaveBeenCalled();
});

test('tapping the avatar calls pickAvatar once a profile exists', async () => {
  const view = await render(<YouScreen />);
  await fireEvent.press(view.getByTestId('avatar-picker'));
  expect(mockPickAvatar).toHaveBeenCalledTimes(1);
});

test('You surfaces the photo-access-off message when the picker is unavailable', async () => {
  mockCommunityProfile.avatarStatus = 'unavailable';
  const view = await render(<YouScreen />);
  expect(view.getByText(/Photo access is off/)).toBeTruthy();
});
