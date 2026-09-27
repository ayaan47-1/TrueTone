// Allergen P1 route-level journey (design §8 P1): Setup skips → allergens → consent → paywall
// (all three answers reach it) → Account shows "{n} flagged" and opens the editor.
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  // You re-reads the flag count on focus; run it once on mount.
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));
const mockRpc = jest.fn();
jest.mock('../../src/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
jest.mock('../../src/lib/profile-context', () => ({
  useProfile: () => ({ userId: 'u1', loading: false, error: false, route: 'home', refresh: jest.fn() }),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../src/features/identity/use-community-profile', () => ({
  useCommunityProfile: () => ({
    profile: { userId: 'u1', username: 'ada', avatarUri: null }, loading: false,
    saveUsername: jest.fn().mockResolvedValue({ ok: true }), pickAvatar: jest.fn(), avatarStatus: 'idle',
  }),
}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: null, nativeBuildVersion: null }), { virtual: true });

import SkipsScreen from '../setup/skips';
import AllergensSetupRoute from '../setup/allergens';
import AllergensRoute from '../allergens';
import YouScreen from '../(tabs)/you';
import { ALLERGEN_COPY as C } from '../../src/content/allergen-copy';

beforeEach(() => {
  jest.clearAllMocks();
  mockRpc.mockResolvedValue({ error: null });
});

test('Skips → Continue goes to the allergen step (not straight to the paywall)', async () => {
  const v = await render(<SkipsScreen />);
  await fireEvent.press(v.getByText('Continue'));
  expect(mockPush).toHaveBeenCalledWith('/setup/allergens');
});

test.each([C.setup.no, C.setup.skip])('"%s" continues to /paywall', async (label) => {
  const v = await render(<AllergensSetupRoute />);
  await fireEvent.press(v.getByText(label));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/paywall'));
});

test('Yes → flags → consent → /paywall, then Account shows "2 flagged" and opens the editor', async () => {
  const v = await render(<AllergensSetupRoute />);
  await fireEvent.press(v.getByText(C.setup.yes));
  await fireEvent.press(v.getByText('Fragrance / parfum'));
  await fireEvent.press(v.getByText('Parabens'));
  await fireEvent.press(v.getByText(C.setup.save));
  await fireEvent.press(v.getByTestId('health-consent-check'));
  await fireEvent.press(v.getByTestId('health-consent-submit'));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/paywall'));
  expect(mockRpc).toHaveBeenCalledWith('record_health_data_consent');

  const you = await render(<YouScreen />);
  await waitFor(() => expect(you.getByText(C.settingsRow.sub(2))).toBeTruthy());
  await fireEvent.press(you.getByText(C.settingsRow.title));
  expect(mockPush).toHaveBeenCalledWith('/allergens');

  const editor = await render(<AllergensRoute />);
  await waitFor(() => expect(editor.getByTestId('group-parabens').props.accessibilityState.selected).toBe(true));
});
