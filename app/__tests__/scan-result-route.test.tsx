import { render, screen, waitFor } from '@testing-library/react-native';
import { DIMENSIONS } from '../../src/content/cosmetic-vocab';
import type { ScoreVector } from '../../src/features/read/read-types';

const mockFetchScanHistory = jest.fn();
jest.mock('../../src/lib/scans', () => ({
  fetchScanHistory: (...args: unknown[]) => mockFetchScanHistory(...args),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: jest.fn() }),
}));

import ResultRoute from '../scan/result';

const scores = Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ScoreVector;
function scan(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    capturedAt: '2026-06-16T00:00:00Z',
    skinType: 'combination',
    scores,
    modelVersion: 'stub-1',
    isStub: true,
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

test('renders the read (disclaimer + a band) when a scan exists', async () => {
  mockFetchScanHistory.mockResolvedValue([scan('s1')]);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText(/not a medical diagnosis/i)).toBeTruthy());
  expect(screen.getByText('Skin type feel: Combination')).toBeTruthy();
});

test('requests the latest two scans (for trend)', async () => {
  mockFetchScanHistory.mockResolvedValue([scan('s1')]);
  await render(<ResultRoute />);
  await waitFor(() => expect(mockFetchScanHistory).toHaveBeenCalledWith(2));
});

test('passes the previous scan so a trend arrow renders', async () => {
  // latest hydration 0.5 vs previous 0.3 → an upward arrow on that row; all other
  // dimensions are equal (0.5 vs 0.5) → 'same' → no arrow, so exactly one ↑ appears.
  mockFetchScanHistory.mockResolvedValue([
    scan('s1'),
    scan('s2', { scores: { ...scores, hydration: 0.3 } }),
  ]);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText(/↑/)).toBeTruthy());
});

test('shows the empty state + Home when there is no scan', async () => {
  mockFetchScanHistory.mockResolvedValue([]);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText(/no scan yet/i)).toBeTruthy());
  expect(screen.getByText(/back to home/i)).toBeTruthy();
});

test('shows the error state when the fetch fails', async () => {
  mockFetchScanHistory.mockRejectedValue(new Error('boom'));
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText(/couldn.t load your read/i)).toBeTruthy());
});
