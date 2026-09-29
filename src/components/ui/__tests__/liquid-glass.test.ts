// hasLiquidGlass() decides between native iOS 26 Liquid Glass (native tabs + GlassView) and the
// Quiet Glass blur fallback (iOS < 26, Android, web). It must never throw: an older dev build
// without the ExpoGlassEffect native module simply falls back.
const mockGlass = { available: true, api: true, throws: false };

jest.mock('expo-glass-effect', () => ({
  isLiquidGlassAvailable: () => {
    if (mockGlass.throws) throw new Error("Cannot find native module 'ExpoGlassEffect'");
    return mockGlass.available;
  },
  isGlassEffectAPIAvailable: () => mockGlass.api,
}));

// Fresh module per call so the cached detection result doesn't leak between tests.
function load() {
  let mod: typeof import('../liquid-glass') | undefined;
  jest.isolateModules(() => {
    mod = require('../liquid-glass');
  });
  return mod!;
}

beforeEach(() => Object.assign(mockGlass, { available: true, api: true, throws: false }));

test('true on iOS when Liquid Glass and its runtime API are both available', () => {
  expect(load().hasLiquidGlass()).toBe(true);
});

test('false on Android and web regardless of the module', () => {
  // babel-preset-expo inlines Platform.OS, so exercise the pure detector per platform.
  const { detectLiquidGlass } = load();
  expect(detectLiquidGlass('android')).toBe(false);
  expect(detectLiquidGlass('web')).toBe(false);
  expect(detectLiquidGlass('ios')).toBe(true);
});

test('false on iOS < 26 (components unavailable)', () => {
  mockGlass.available = false;
  expect(load().hasLiquidGlass()).toBe(false);
});

test('false on early iOS 26 betas missing the runtime API', () => {
  mockGlass.api = false;
  expect(load().hasLiquidGlass()).toBe(false);
});

test('false (no throw) when the native module is missing from the build', () => {
  mockGlass.throws = true;
  expect(load().hasLiquidGlass()).toBe(false);
});

test('tab-bar clearance is smaller under the native bar than under the floating glass bar', () => {
  const native = load().tabBarClearance();
  mockGlass.available = false;
  const fallback = load().tabBarClearance();
  expect(fallback).toBe(108);
  expect(native).toBeLessThan(fallback);
  expect(native).toBeGreaterThan(0);
});
