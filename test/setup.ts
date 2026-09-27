import '@testing-library/jest-native/extend-expect';

// Reanimated's native/worklets layer can't initialise under Jest (and the shipped
// mock still pulls it in), so stub the slice we use: Animated.View + chainable
// layout-animation builders (FadeIn/FadeInDown).
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  // Chainable no-op for `FadeIn.duration(220)`, `FadeInDown.springify().damping(20)`, etc.
  const builder = () => new Proxy(() => builder(), { get: () => () => builder() });
  const easing = () => easing;
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    FadeIn: builder(),
    FadeInDown: builder(),
    FadeInUp: builder(),
    // Motion primitives (src/theme/motion.ts, Rise, PressableScale). The worklet layer never runs
    // under Jest, so animations resolve to their target value synchronously.
    Easing: { out: easing, in: easing, inOut: easing, cubic: easing, bezier: () => easing },
    useReducedMotion: () => false,
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (to: unknown) => to,
    withSpring: (to: unknown) => to,
    withDelay: (_ms: number, animation: unknown) => animation,
  };
});

// Fonts load via native module at runtime; under Jest there's no loader, so treat
// them as already-loaded. Keeps RootLayout rendering its real tree in tests.
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: async () => {},
}));

// AsyncStorage backs the on-device skin-feel diary; use its official in-memory mock
// so any suite that pulls it in (directly or via DataRights) runs without the native
// module. Individual tests can still spy on it.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-secure-store (Keychain) backs the encrypted on-device allergen profile. In-memory mock;
// `virtual` so suites run even where the native package isn't linked into node_modules.
// Tests reach the backing map via require('expo-secure-store').__store.
jest.mock(
  'expo-secure-store',
  () => {
    const store = new Map<string, string>();
    return {
      __store: store,
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
      getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
      setItemAsync: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
      deleteItemAsync: jest.fn(async (k: string) => { store.delete(k); }),
    };
  },
  { virtual: true },
);
beforeEach(() => {
  require('expo-secure-store').__store.clear();
});

jest.mock('@stripe/stripe-react-native', () => {
  return {
    StripeProvider: ({ children }: any) => children,
    useStripe: () => ({
      initPaymentSheet: jest.fn().mockResolvedValue({ error: undefined }),
      presentPaymentSheet: jest.fn().mockResolvedValue({ error: undefined }),
    }),
  };
});
