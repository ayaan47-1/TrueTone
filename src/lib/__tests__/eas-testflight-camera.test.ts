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

// EAS rejects empty env values, so each one is a placeholder that can never reach a server:
// hosts use the reserved .invalid TLD (RFC 2606) and keys are the literal word "offline".
test.each([
  ['EXPO_PUBLIC_SUPABASE_URL', 'http://offline.invalid'],
  ['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'offline'],
  ['EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'offline'],
  ['EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN', 'offline.invalid'],
  ['EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN', 'offline'],
  ['EXPO_PUBLIC_SHOPIFY_CHECKOUT_HOSTS', 'offline.invalid'],
])('overrides %s with an unreachable placeholder', (name, placeholder) => {
  expect(profile.env?.[name] === placeholder).toBe(true);
});

test('has no empty env values (EAS rejects them)', () => {
  for (const value of Object.values(profile.env ?? {})) {
    expect(value.length > 0).toBe(true);
  }
});
