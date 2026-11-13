// app/__tests__/scan-render-guard.test.tsx
// Render-level (structural) companion to demo-scan-guard.test.tsx's effect-level check.
// DEMO_MODE must make it IMPOSSIBLE for <Capture> to ever enter the render tree at
// /scan, not merely redirected-away-fast by an effect after mount -- for multi-device
// TestFlight there is no guaranteed effect-timing window. Asserts app/scan/index.tsx
// itself, independent of the root Guard in app/_layout.tsx.
import { render } from '@testing-library/react-native';

const mockCapture = jest.fn((_props: unknown) => null);
jest.mock('../../src/features/capture/Capture', () => ({
  Capture: (props: unknown) => mockCapture(props),
}));

jest.mock('../../src/features/read/run-read', () => ({ runRead: jest.fn() }));

let mockDemoMode = false;
let mockCameraDemo = false;
const mockProfile = { loading: false, error: false, route: 'home', userId: 'user' };
jest.mock('../../src/lib/profile-context', () => ({ useProfile: () => mockProfile }));
jest.mock('../../src/lib/supabase', () => ({
  get DEMO_MODE() {
    return mockDemoMode;
  },
  get CAMERA_DEMO() {
    return mockCameraDemo;
  },
  supabase: {},
}));

let mockFixtureScan = false;
jest.mock('../../src/lib/e2e-fixture', () => ({
  get E2E_FIXTURE_SCAN() {
    return mockFixtureScan;
  },
}));
jest.mock('../../src/features/capture/e2e-fixture-image', () => ({
  E2E_FIXTURE_IMAGE_BASE64_JPEG: 'fake-base64',
}));
const mockWriteAsStringAsync = jest.fn((_uri: string, _contents: string, _options?: unknown) =>
  Promise.resolve(),
);
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: (uri: string, contents: string, options?: unknown) =>
    mockWriteAsStringAsync(uri, contents, options),
}));

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text>redirect:{href}</Text>,
    useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: mockBack }),
  };
});

import ScanRoute from '../scan/index';

beforeEach(() => {
  jest.clearAllMocks();
  mockDemoMode = false;
  mockCameraDemo = false;
  mockFixtureScan = false;
  mockWriteAsStringAsync.mockClear();
  Object.assign(mockProfile, { loading: false, error: false, route: 'home', userId: 'user' });
});

test.each([
  { loading: true }, { error: true }, { route: 'consent' }, { route: 'age-gate' },
  { route: 'region-blocked' }, { userId: null },
])('does not mount capture while profile is gated or unknown: %j', async (state) => {
  Object.assign(mockProfile, state);
  await render(<ScanRoute />);
  expect(mockCapture).not.toHaveBeenCalled();
});

test('DEMO_MODE on: <Capture> never renders -- a synchronous redirect takes its place', async () => {
  mockDemoMode = true;
  const view = await render(<ScanRoute />);
  expect(mockCapture).not.toHaveBeenCalled();
  expect(view.getByText('redirect:/')).toBeTruthy();
});

test('DEMO_MODE off: renders <Capture> as before, real scans unaffected', async () => {
  mockDemoMode = false;
  await render(<ScanRoute />);
  expect(mockCapture).toHaveBeenCalledTimes(1);
});

test('CAMERA_DEMO on (plain DEMO_MODE off): camera is reachable, same as a real build', async () => {
  mockCameraDemo = true;
  await render(<ScanRoute />);
  expect(mockCapture).toHaveBeenCalledTimes(1);
});

test('both flags on (should never happen in a real build) still blocks -- DEMO_MODE wins', async () => {
  mockDemoMode = true;
  mockCameraDemo = true;
  const view = await render(<ScanRoute />);
  expect(mockCapture).not.toHaveBeenCalled();
  expect(view.getByText('redirect:/')).toBeTruthy();
});

// --- E2E_FIXTURE_SCAN (HAG-231): replaces only the capture step, gates unchanged ---

test('E2E_FIXTURE_SCAN on, gates clear: <Capture> never mounts, the fixture is written and fed through handleCaptured', async () => {
  mockFixtureScan = true;
  await render(<ScanRoute />);
  expect(mockCapture).not.toHaveBeenCalled();
  await new Promise((resolve) => setImmediate(resolve));
  expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
  const [fixtureUri, contents] = mockWriteAsStringAsync.mock.calls[0];
  expect(fixtureUri).toBe('file:///cache/e2e-fixture-scan.jpg');
  expect(contents).toBe('fake-base64');
  expect(mockReplace).toHaveBeenCalledWith('/scan/result');
});

test.each([
  { loading: true }, { error: true }, { route: 'consent' }, { route: 'age-gate' },
  { route: 'region-blocked' }, { userId: null },
])('E2E_FIXTURE_SCAN on, but gated or unknown: no fixture write, no capture: %j', async (state) => {
  mockFixtureScan = true;
  Object.assign(mockProfile, state);
  await render(<ScanRoute />);
  await new Promise((resolve) => setImmediate(resolve));
  expect(mockCapture).not.toHaveBeenCalled();
  expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
});

test('E2E_FIXTURE_SCAN on, but DEMO_MODE also on: DEMO_MODE still wins, no fixture write', async () => {
  mockFixtureScan = true;
  mockDemoMode = true;
  const view = await render(<ScanRoute />);
  await new Promise((resolve) => setImmediate(resolve));
  expect(mockCapture).not.toHaveBeenCalled();
  expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
  expect(view.getByText('redirect:/')).toBeTruthy();
});

test('E2E_FIXTURE_SCAN off (default): no fixture write, real <Capture> path unaffected', async () => {
  await render(<ScanRoute />);
  await new Promise((resolve) => setImmediate(resolve));
  expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
  expect(mockCapture).toHaveBeenCalledTimes(1);
});
