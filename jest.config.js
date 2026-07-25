module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect', './test/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|@supabase/.*))',
  ],
  // Integration tests hit a running local Supabase; excluded from the default unit run.
  // Run them with `npm run test:integration`.
  // '.claude/worktrees/*' are nested git worktrees with their own node_modules
  // (duplicate React) — never part of this project's suite.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/test/integration/', '<rootDir>/.claude/'],
  moduleNameMapper: { '\\.css$': '<rootDir>/test/css-stub.js' },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
  // Device-only native shells (vision-camera capture / on-device read) can't run under Jest or the
  // Simulator; their real logic lives in pure, unit-tested modules (quality-gate, capture-controller).
  // Mirror P1's approach instead of writing brittle native mocks (plan Task 4.x).
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/features/capture/Capture.tsx',
    '<rootDir>/src/features/capture/use-frame-metrics.ts',
    '<rootDir>/app/scan/index.tsx',
    '<rootDir>/src/features/read/detect-faces-still.ts',
  ],
  coverageThreshold: { global: { lines: 80, statements: 80, branches: 70, functions: 80 } },
};
