import { render, screen } from '@testing-library/react-native';

// ---- mocks (must be mock-prefixed for jest factory hoisting) ----
const mockUseProfile = jest.fn();
const mockRefresh = jest.fn();
const mockReplace = jest.fn();
const mockPathname = jest.fn(() => '/');
jest.mock('../../src/lib/profile-context', () => ({
  useProfile: () => mockUseProfile(),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  // Stack renders a marker and ignores its <Stack.Screen> config children.
  const Stack = Object.assign(() => <Text>stack</Text>, { Screen: () => null });
  return {
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
    Stack,
    useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
    usePathname: () => mockPathname(),
    useLocalSearchParams: () => ({ doc: 'privacy' }),
  };
});

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
    rpc: async () => ({ error: null }),
  },
}));

import AgeGateRoute from '../age-gate';
import ConsentRoute from '../consent';
import DataScreen from '../data/index';
import PoliciesScreen from '../policies/index';
import PolicyReaderScreen from '../policies/[doc]';
import RegionBlocked from '../region-blocked';
import RootLayout from '../_layout';

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname.mockReturnValue('/');
  mockUseProfile.mockReturnValue({
    loading: false,
    error: false,
    route: 'home',
    userId: 'u1',
    refresh: mockRefresh,
  });
});

test('age-gate route renders the gate when a userId exists', async () => {
  await render(<AgeGateRoute />);
  expect(screen.getByText(/date of birth/i)).toBeTruthy();
});

test('age-gate route fails closed (Preparing) without a userId', async () => {
  mockUseProfile.mockReturnValue({ userId: null, refresh: mockRefresh });
  await render(<AgeGateRoute />);
  expect(screen.getByText(/preparing/i)).toBeTruthy();
});

test('consent route renders the consent screen', async () => {
  await render(<ConsentRoute />);
  expect(screen.getByText(/before we scan your skin/i)).toBeTruthy();
});

test('data route renders the data-rights actions', async () => {
  await render(<DataScreen />);
  expect(screen.getByText('Your Data')).toBeTruthy();
});

test('policies route lists the policies', async () => {
  await render(<PoliciesScreen />);
  expect(screen.getByText('Privacy Policy')).toBeTruthy();
});

test('policy reader renders the selected doc body', async () => {
  await render(<PolicyReaderScreen />);
  expect(screen.getByText(/Privacy Policy pending counsel review/i)).toBeTruthy();
});

test('region-blocked route renders the not-available message', async () => {
  await render(<RegionBlocked />);
  expect(screen.getByText(/not available in your region/i)).toBeTruthy();
});

test('root layout shows loading state', async () => {
  mockUseProfile.mockReturnValue({ loading: true, error: false, route: 'home' });
  await render(<RootLayout />);
  expect(screen.getByText(/warming up your mirror/i)).toBeTruthy();
});

test('root layout shows fail-closed error state', async () => {
  mockUseProfile.mockReturnValue({ loading: false, error: true, route: 'home' });
  await render(<RootLayout />);
  expect(screen.getByText(/connection problem/i)).toBeTruthy();
});

test('root layout redirects to a gate route (imperatively, keeping the Stack mounted)', async () => {
  mockUseProfile.mockReturnValue({ loading: false, error: false, route: 'consent' });
  await render(<RootLayout />);
  // Stack always renders (so the target screen can mount); the gate is enforced by navigation.
  expect(screen.getByText('stack')).toBeTruthy();
  expect(mockReplace).toHaveBeenCalledWith('/consent');
});

test('root layout advances into the app once the last gate clears', async () => {
  // All gates passed (route=home) but still sitting on the consent screen → enter the app.
  mockUseProfile.mockReturnValue({ loading: false, error: false, route: 'home' });
  mockPathname.mockReturnValue('/consent');
  await render(<RootLayout />);
  expect(mockReplace).toHaveBeenCalledWith('/');
});

test('root layout does not redirect when already home', async () => {
  mockUseProfile.mockReturnValue({ loading: false, error: false, route: 'home' });
  mockPathname.mockReturnValue('/');
  await render(<RootLayout />);
  expect(mockReplace).not.toHaveBeenCalled();
});

test('root layout renders the app stack when unlocked', async () => {
  mockUseProfile.mockReturnValue({ loading: false, error: false, route: 'home' });
  await render(<RootLayout />);
  expect(screen.getByText('stack')).toBeTruthy();
});
