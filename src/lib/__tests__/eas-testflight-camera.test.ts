// Dwight FAIL on PR #60: the testflight-camera profile must not inherit production config.
// Values are compared, never printed.
import eas from '../../../eas.json';

const profile = (eas.build as Record<string, { environment?: string; env?: Record<string, string> }>)[
  'testflight-camera'
];

test('uses the preview EAS environment, never production', () => {
  expect(profile.environment).toBe('preview');
});

test('turns the camera demo on and the stubbed demo off', () => {
  expect(profile.env?.EXPO_PUBLIC_CAMERA_DEMO).toBe('1');
  expect(profile.env?.EXPO_PUBLIC_DEMO).toBe('0');
});

test.each([
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN',
  'EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN',
  'EXPO_PUBLIC_SHOPIFY_CHECKOUT_HOSTS',
])('blanks %s', (name) => {
  expect(profile.env).toHaveProperty(name);
  expect(profile.env?.[name] === '').toBe(true);
});
