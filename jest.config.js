module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect', './test/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|@supabase/.*))',
  ],
  // Integration tests hit a running local Supabase; excluded from the default unit run.
  // Run them with `npm run test:integration`.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/test/integration/'],
  moduleNameMapper: { '\\.css$': '<rootDir>/test/css-stub.js' },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
  coverageThreshold: { global: { lines: 80, statements: 80, branches: 70, functions: 80 } },
};
