import { render, screen } from '@testing-library/react-native';

// ---- mocks (must be mock-prefixed for jest factory hoisting) ----
const mockUseProfile = jest.fn();
const mockRefresh = jest.fn();
jest.mock('../../src/lib/profile-context', () => ({
  useProfile: () => mockUseProfile(),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
    Stack: () => <Text>stack</Text>,
    useRouter: () => ({ push: jest.fn() }),
    useLocalSearchParams: () => ({ doc: 'privacy' }),
  };
});

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
    rpc: async () => ({ error: null }),
  },
}));

import IndexRoute from '../index';
import AgeGateRoute from '../age-gate';
import ConsentRoute from '../consent';
import DataScreen from '../data/index';
import PoliciesScreen from '../policies/index';
import PolicyReaderScreen from '../policies/[doc]';
import RegionBlocked from '../region-blocked';
import RootLayout from '../_layout';

beforeEach(() => {
  jest.clearAllMocks();
  mockUseProfile.mockReturnValue({
    loading: false,
    error: false,
    route: 'home',
    userId: 'u1',
    refresh: mockRefresh,
  });
});

test('index route renders the onboarding disclaimer', async () => {
  await render(<IndexRoute />);
  expect(screen.getByText(/not a medical device/i)).toBeTruthy();
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
  expect(screen.getByText(/loading/i)).toBeTruthy();
});

test('root layout shows fail-closed error state', async () => {
  mockUseProfile.mockReturnValue({ loading: false, error: true, route: 'home' });
  await render(<RootLayout />);
  expect(screen.getByText(/connection problem/i)).toBeTruthy();
});

test('root layout redirects to a gate route', async () => {
  mockUseProfile.mockReturnValue({ loading: false, error: false, route: 'consent' });
  await render(<RootLayout />);
  expect(screen.getByText('redirect:/consent')).toBeTruthy();
});

test('root layout renders the app stack when unlocked', async () => {
  mockUseProfile.mockReturnValue({ loading: false, error: false, route: 'home' });
  await render(<RootLayout />);
  expect(screen.getByText('stack')).toBeTruthy();
});
