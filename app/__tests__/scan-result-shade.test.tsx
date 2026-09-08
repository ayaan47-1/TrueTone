// app/__tests__/scan-result-shade.test.tsx
// The live camera shade-match path of app/scan/result.tsx: the shade is derived at capture
// time and published via personalization.setScan (ReadResult.tone does not survive the DB
// round-trip). When a currentShade exists, the screen renders the shade name + product picks
// (NOT the skin-read analysis).
import { render, screen, waitFor } from '@testing-library/react-native';
import { personalization } from '../../src/features/session/personalization';
import type { CurrentShade } from '../../src/features/shade/shade-types';

const mockFetchScanHistory = jest.fn();
jest.mock('../../src/lib/scans', () => ({
  fetchScanHistory: (...args: unknown[]) => mockFetchScanHistory(...args),
  setRoutineFeedback: jest.fn(),
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: mockPush }),
}));

import ResultRoute from '../scan/result';

const shade: CurrentShade = { shadeName: 'Medium Warm', undertone: 'warm', depth: 6, finish: 'satin' };

beforeEach(() => {
  jest.clearAllMocks();
  personalization.reset();
});
afterEach(() => personalization.reset());

test('renders the shade name from the persisted shade', async () => {
  personalization.setScan(shade);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText('Medium Warm')).toBeTruthy());
});

test('renders the product picks rail (matched to the shade)', async () => {
  personalization.setScan(shade);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText('Picked for your shade')).toBeTruthy());
});

test('does NOT show the skin-read analysis (no medical disclaimer / skin-type line)', async () => {
  personalization.setScan(shade);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText('Medium Warm')).toBeTruthy());
  expect(screen.queryByText(/not a medical diagnosis/i)).toBeNull();
  expect(screen.queryByText(/Skin type feel:/i)).toBeNull();
});

test('does NOT hit the scan-history network path in the shade flow', async () => {
  personalization.setScan(shade);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText('Medium Warm')).toBeTruthy());
  expect(mockFetchScanHistory).not.toHaveBeenCalled();
});

test('falls back to the skin-read flow when no shade is present', async () => {
  mockFetchScanHistory.mockResolvedValue([]);
  await render(<ResultRoute />);
  await waitFor(() => expect(mockFetchScanHistory).toHaveBeenCalledWith(10));
});
