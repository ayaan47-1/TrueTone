// src/lib/__tests__/e2e-force-persist-failure.test.ts
// E2E_FORCE_PERSIST_FAILURE must be impossible to reach outside a __DEV__ build, regardless of
// the env flag's value -- same contract as E2E_FIXTURE_SCAN (HAG-231). This is the RED test for
// that gate: written before the module exists, confirmed failing for the right reason, then the
// minimal __DEV__-fenced flag is implemented.
describe('E2E_FORCE_PERSIST_FAILURE', () => {
  const ORIGINAL_DEV = (global as { __DEV__?: boolean }).__DEV__;
  const ORIGINAL_ENV = process.env.EXPO_PUBLIC_E2E_FORCE_PERSIST_FAILURE;

  afterEach(() => {
    (global as { __DEV__?: boolean }).__DEV__ = ORIGINAL_DEV;
    if (ORIGINAL_ENV === undefined) delete process.env.EXPO_PUBLIC_E2E_FORCE_PERSIST_FAILURE;
    else process.env.EXPO_PUBLIC_E2E_FORCE_PERSIST_FAILURE = ORIGINAL_ENV;
    jest.resetModules();
  });

  function load(devFlag: boolean, envValue: string | undefined): boolean {
    jest.resetModules();
    (global as { __DEV__?: boolean }).__DEV__ = devFlag;
    if (envValue === undefined) delete process.env.EXPO_PUBLIC_E2E_FORCE_PERSIST_FAILURE;
    else process.env.EXPO_PUBLIC_E2E_FORCE_PERSIST_FAILURE = envValue;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must re-require after
    // resetModules() so the module-level const is recomputed against the new __DEV__/env.
    return require('../e2e-force-persist-failure').E2E_FORCE_PERSIST_FAILURE;
  }

  test('release build (__DEV__=false): flag set to "1" is still unreachable', () => {
    expect(load(false, '1')).toBe(false);
  });

  test('release build (__DEV__=false): flag unset is unreachable', () => {
    expect(load(false, undefined)).toBe(false);
  });

  test('dev build (__DEV__=true), flag unset: inert by default', () => {
    expect(load(true, undefined)).toBe(false);
  });

  test('dev build (__DEV__=true), flag="0": explicitly off', () => {
    expect(load(true, '0')).toBe(false);
  });

  test('dev build (__DEV__=true), flag="1": reachable', () => {
    expect(load(true, '1')).toBe(true);
  });

  test('dev build (__DEV__=true), flag="true": reachable (same truthy parsing as E2E_FIXTURE_SCAN)', () => {
    expect(load(true, 'true')).toBe(true);
  });
});
