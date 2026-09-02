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
jest.mock('../../src/lib/supabase', () => ({
  get DEMO_MODE() {
    return mockDemoMode;
  },
  supabase: {},
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
