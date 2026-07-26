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
