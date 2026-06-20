import '@testing-library/jest-native/extend-expect';

// Reanimated's native/worklets layer can't initialise under Jest (and the shipped
// mock still pulls it in), so stub the slice we use: Animated.View + chainable
// layout-animation builders (FadeIn/FadeInDown).
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  // Chainable no-op for `FadeIn.duration(220)`, `FadeInDown.springify().damping(20)`, etc.
  const builder = () => new Proxy(() => builder(), { get: () => () => builder() });
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    FadeIn: builder(),
    FadeInDown: builder(),
  };
});

// Fonts load via native module at runtime; under Jest there's no loader, so treat
// them as already-loaded. Keeps RootLayout rendering its real tree in tests.
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: async () => {},
}));
