// MASVS M1: surfaced avatar cleanup failure.
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));
jest.mock('../../src/lib/scans', () => ({
  fetchScanHistoryCount: jest.fn(() => Promise.resolve(3)),
}));
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
    avatarStatus: 'cleanup-incomplete',
  }),
}));

import YouScreen from '../(tabs)/you';

// MASVS M1 (Dwight ruling): an old photo copy that could not be deleted is surfaced, not hidden.
it('tells the user when an older photo copy could not be deleted yet', async () => {
  const view = await render(<YouScreen />);
  expect(view.getByText(/older copy of your photo couldn.t be deleted/i)).toBeTruthy();
  await new Promise((r) => setTimeout(r, 0));
});
