// Config for the fairness invariance evaluation harness under eval/.
//
// eval/ is deliberately excluded from the default `npm test` run (see the note in
// jest.config.js), so running `jest eval/` would match nothing — the base config's
// ignore list would filter it straight back out. This config reuses everything else
// from the base and re-admits eval/ as the only thing it collects.
const base = require('./jest.config.js');

module.exports = {
  ...base,
  // Same exclusions as the base minus eval/ itself. test/integration/ still needs a
  // live Supabase, and .claude/worktrees/* carry a duplicate React.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/test/integration/', '<rootDir>/.claude/'],
  testMatch: ['<rootDir>/eval/**/__tests__/**/*.test.ts'],
};
