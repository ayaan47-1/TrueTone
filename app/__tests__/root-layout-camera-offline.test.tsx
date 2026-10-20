// Camera build (Dwight FAIL on PR #60): Stripe must never get a publishable key, even if one
// leaks into the build environment, and the Shopify checkout sheet is never set up.
import { render } from '@testing-library/react-native';

const mockStripeKeys: string[] = [];
let mockOffline = true;
jest.mock('@stripe/stripe-react-native', () => ({
  StripeProvider: ({ children, publishableKey }: { children: React.ReactNode; publishableKey: string }) => {
    mockStripeKeys.push(publishableKey);
    return children;
  },
  useStripe: () => ({}),
}));
let mockSheetRenders = 0;
jest.mock('@shopify/checkout-sheet-kit', () => ({
  ShopifyCheckoutSheetProvider: ({ children }: { children: React.ReactNode }) => {
    mockSheetRenders += 1;
    return children;
  },
}));
jest.mock('../../src/lib/profile-context', () => ({
  useProfile: () => ({ loading: false, error: false, route: 'home', userId: 'u', refresh: jest.fn() }),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  const Stack = Object.assign(() => <Text>stack</Text>, { Screen: () => null });
  return {
    Stack,
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    usePathname: () => '/',
  };
});
jest.mock('../../src/lib/supabase', () => ({
  DEMO_MODE: false,
  get SUPABASE_OFFLINE() {
    return mockOffline;
  },
  supabase: {},
}));

import RootLayout from '../_layout';

const originalKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
beforeEach(() => {
  mockStripeKeys.length = 0;
  mockSheetRenders = 0;
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_live_prodlike';
});
afterAll(() => {
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalKey;
});

test('camera build gives Stripe an empty key', async () => {
  mockOffline = true;
  await render(<RootLayout />);
  expect(mockStripeKeys.length).toBeGreaterThan(0);
  expect(mockStripeKeys.every((k) => k === '')).toBe(true);
});

test('control: a normal build passes the configured key through', async () => {
  mockOffline = false;
  await render(<RootLayout />);
  expect(mockStripeKeys.some((k) => k === 'pk_live_prodlike')).toBe(true);
});

test('camera build never mounts the Shopify checkout sheet provider', async () => {
  mockOffline = true;
  await render(<RootLayout />);
  expect(mockSheetRenders).toBe(0);
});

test('control: a normal build mounts the Shopify checkout sheet provider', async () => {
  mockOffline = false;
  await render(<RootLayout />);
  expect(mockSheetRenders).toBeGreaterThan(0);
});
