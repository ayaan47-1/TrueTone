// app/__tests__/demo-scan-guard.test.tsx
// BIPA defense-in-depth: DEMO_MODE stubs an already-onboarded identity and skips the
// gate chain (profile-context.tsx), so nothing else stops /scan from mounting a live
// camera with no age-gate/consent in front of it. Asserts the RootLayout guard
// (app/_layout.tsx) redirects away from /scan whenever DEMO_MODE is on, using the same
// mock/assert convention as app/__tests__/routes.test.tsx's other gate-redirect tests.
import { render, screen } from '@testing-library/react-native';

const mockUseProfile = jest.fn();
const mockReplace = jest.fn();
const mockPathname = jest.fn(() => '/');
jest.mock('../../src/lib/profile-context', () => ({
  useProfile: () => mockUseProfile(),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  const Stack = Object.assign(() => <Text>stack</Text>, { Screen: () => null });
  return {
    Stack,
    useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
    usePathname: () => mockPathname(),
  };
});

// DEMO_MODE fixed true for this whole file -- a build-time constant in the real app, so a
// module-level mock (rather than a per-test toggle) matches how it actually behaves.
jest.mock('../../src/lib/supabase', () => ({ DEMO_MODE: true, supabase: {} }));

import RootLayout from '../_layout';

beforeEach(() => {
  jest.clearAllMocks();
  // Demo mode always stands in a cleared-gates identity (profile-context.tsx sets
  // route via nextRoute({isUS:true, is18:true, consent:true}) === 'home').
  mockUseProfile.mockReturnValue({ loading: false, error: false, route: 'home', userId: 'demo-user' });
});

test('DEMO_MODE on: navigating to /scan redirects home instead of mounting the camera', async () => {
  mockPathname.mockReturnValue('/scan');
  await render(<RootLayout />);
  expect(mockReplace).toHaveBeenCalledWith('/');
});

test('DEMO_MODE on: does not redirect away from other unblocked routes', async () => {
  mockPathname.mockReturnValue('/');
  await render(<RootLayout />);
  expect(mockReplace).not.toHaveBeenCalled();
});

test('DEMO_MODE on: the Stack still mounts (screens aren’t torn down to redirect)', async () => {
  mockPathname.mockReturnValue('/scan');
  await render(<RootLayout />);
  expect(screen.getByText('stack')).toBeTruthy();
});
