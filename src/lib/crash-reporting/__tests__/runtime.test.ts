import type { ReactNativeOptions } from '@sentry/react-native';
const mockInit = jest.fn<void, [ReactNativeOptions]>();
const mockSdkLoad = jest.fn();
jest.mock('@sentry/react-native', () => {
  mockSdkLoad();
  return { init: mockInit, reactNativeErrorHandlersIntegration: () => ({ name: 'ReactNativeErrorHandlers' }), debugMetaIntegration: () => ({name:'DebugMeta'}) };
});
jest.mock('../../supabase', () => ({ DEMO_MODE: false, SUPABASE_OFFLINE: false }));

const dsn = 'https://public@example.invalid/1';
const originalNodeEnv = process.env.NODE_ENV;
const originalDev = __DEV__;
beforeEach(() => {
  jest.resetModules(); jest.clearAllMocks(); delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  delete process.env.EXPO_PUBLIC_E2E; process.env.NODE_ENV = 'production'; Object.defineProperty(globalThis, '__DEV__', { value: false, configurable: true });
});
afterEach(() => { process.env.NODE_ENV = originalNodeEnv; Object.defineProperty(globalThis, '__DEV__', { value: originalDev, configurable: true }); });
afterAll(() => { delete process.env.EXPO_PUBLIC_SENTRY_DSN; delete process.env.EXPO_PUBLIC_E2E; });

test.each([
  { dsn: undefined, demo: false, offline: false },
  { dsn: '', demo: false, offline: false },
  { dsn, demo: true, offline: false },
  { dsn, demo: false, offline: true },
])('does not even load the SDK when disabled: %j', async flags => {
  if (flags.dsn) process.env.EXPO_PUBLIC_SENTRY_DSN = flags.dsn;
  jest.doMock('../../supabase', () => ({ DEMO_MODE: flags.demo, SUPABASE_OFFLINE: flags.offline }));
  const { initializeCrashReporting }: typeof import('../runtime') = require('../runtime');
  initializeCrashReporting();
  expect(mockSdkLoad).not.toHaveBeenCalled();
  expect(mockInit).not.toHaveBeenCalled();
});

test('ignores alternate SENTRY_DSN; only the public Expo DSN may enable reporting', async () => {
  process.env.SENTRY_DSN = dsn;
  const { initializeCrashReporting }: typeof import('../runtime') = require('../runtime');
  initializeCrashReporting();
  expect(mockSdkLoad).not.toHaveBeenCalled();
  delete process.env.SENTRY_DSN;
});

test('initializes once with no native, replay, tracing, session, attachment or automatic data collection', async () => {
  process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;
  jest.doMock('../../supabase', () => ({ DEMO_MODE: false, SUPABASE_OFFLINE: false }));
  const { initializeCrashReporting }: typeof import('../runtime') = require('../runtime');
  initializeCrashReporting(); initializeCrashReporting();
  expect(mockInit).toHaveBeenCalledTimes(1);
  expect(mockInit).toHaveBeenCalledWith(expect.objectContaining({
    dsn, sendDefaultPii: false, enableNative: false, autoInitializeNativeSdk: false,
    enableNativeCrashHandling: false, attachScreenshot: false, attachViewHierarchy: false,
    enableLogs: false, enableAutoSessionTracking: false, sendClientReports: false,
    tracesSampleRate: 0, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0,
    maxBreadcrumbs: 0, defaultIntegrations: false, integrations: [{ name: 'ReactNativeErrorHandlers' }, {name:'DebugMeta'}],
    beforeSend: expect.any(Function), beforeBreadcrumb: expect.any(Function),
  }));
});

test.each(['development', 'test', 'fixture'])('does not load the SDK in %s builds even with a DSN', mode => {
  process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;
  if (mode === 'fixture') process.env.EXPO_PUBLIC_E2E = '1';
  else if (mode === 'development') Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true });
  else process.env.NODE_ENV = 'test';
  jest.doMock('../../supabase', () => ({ DEMO_MODE: false, SUPABASE_OFFLINE: false }));
  const { initializeCrashReporting }: typeof import('../runtime') = require('../runtime');
  initializeCrashReporting();
  expect(mockSdkLoad).not.toHaveBeenCalled();
  expect(mockInit).not.toHaveBeenCalled();
});

test('installed callback fails closed until a known route renders, and immediately suppresses scan errors', async () => {
  process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;
  jest.doMock('../../supabase', () => ({ DEMO_MODE: false, SUPABASE_OFFLINE: false }));
  const { initializeCrashReporting, setCrashReportingRoute }: typeof import('../runtime') = require('../runtime');
  initializeCrashReporting();
  const options = mockInit.mock.calls[0][0];
  if (!options.beforeSend || !options.beforeBreadcrumb) throw new Error('Missing privacy hooks');
  const event = { type: undefined, exception: { values: [{ type: 'Error', value: 'private', stacktrace: { frames: [{ filename: 'app:///main.js', lineno: 17 }] } }] } };
  expect(await options.beforeSend(event, {})).toBeNull();
  setCrashReportingRoute('/shop');
  expect(await options.beforeSend(event, {})).toEqual({ type: undefined, platform: 'javascript', level: 'error', sdk:{name:'sentry.javascript.react-native',version:'8.35.0',settings:{infer_ip:'never'}}, exception: { values: [{ type: 'Error', value: 'Crash details redacted', stacktrace: { frames: [{ filename:'main.js',lineno:17 }] } }] } });
  setCrashReportingRoute('/scan');
  expect(await options.beforeSend(event, {})).toBeNull();
  setCrashReportingRoute('/shop');
  expect(await options.beforeSend(event, {})).toBeNull();
  expect(options.beforeBreadcrumb({message:'private'},{})).toBeNull();
});

test('the group-stripped developer path keeps reporting suppressed after navigation away', () => {
  process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;
  jest.doMock('../../supabase', () => ({ DEMO_MODE: false, SUPABASE_OFFLINE: false }));
  const { initializeCrashReporting, setCrashReportingRoute }: typeof import('../runtime') = require('../runtime');
  initializeCrashReporting();
  const options = mockInit.mock.calls[0][0];
  if (!options.beforeSend) throw new Error('Missing privacy hook');
  const event = { type:undefined, exception:{values:[{type:'Error',stacktrace:{frames:[{filename:'app:///main.js',lineno:3}]}}]} };
  setCrashReportingRoute('/bbox-overlay');
  expect(options.beforeSend(event,{})).toBeNull();
  setCrashReportingRoute('/shop');
  expect(options.beforeSend(event,{})).toBeNull();
});
