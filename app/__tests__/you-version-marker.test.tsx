import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

// The Account screen now also carries the identity seam (Task 11) and the routine logger
// (Task 13), so this suite mocks the same app-context deps tabs.test uses: a signed-in
// userId and a loaded CommunityProfile. The routine logger reads AsyncStorage via the
// global in-memory mock (test/setup.ts), so it needs no extra wiring.
jest.mock('../../src/lib/profile-context', () => ({
  useProfile: () => ({ userId: 'test-user', loading: false, error: false, route: 'home', refresh: jest.fn() }),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../src/features/identity/use-community-profile', () => ({
  useCommunityProfile: () => ({
    profile: { userId: 'test-user', username: 'ada', avatarUri: null },
    loading: false,
    saveUsername: jest.fn().mockResolvedValue({ ok: true }),
    pickAvatar: jest.fn(),
    avatarStatus: 'idle',
  }),
}));

// Mutable control over the native version values; getters re-read per call, so a single
// static mock covers both the "has version" and "Expo Go / unavailable" cases.
const native: { version: string | null; build: string | null } = { version: null, build: null };
jest.mock('expo-application', () => ({
  get nativeApplicationVersion() {
    return native.version;
  },
  get nativeBuildVersion() {
    return native.build;
  },
}));

import YouScreen from '../(tabs)/you';

describe('Account screen version marker', () => {
  it('shows the installed binary version + build as a low-emphasis footer', async () => {
    native.version = '1.0.0';
    native.build = '2';
    const view = await render(<YouScreen />);
    expect(view.getByText('Version 1.0.0 (2)')).toBeTruthy();
  });

  it('renders no marker when the native version is unavailable', async () => {
    native.version = null;
    native.build = null;
    const view = await render(<YouScreen />);
    expect(view.queryByText(/^Version /)).toBeNull();
  });
});
