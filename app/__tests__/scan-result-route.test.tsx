import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { DIMENSIONS } from '../../src/content/cosmetic-vocab';
import type { ScoreVector } from '../../src/features/read/read-types';
import { setEntitlementSource, localStubEntitlement } from '../../src/features/premium/entitlement';

const mockFetchScanHistory = jest.fn();
const mockSetRoutineFeedback = jest.fn();
jest.mock('../../src/lib/scans', () => ({
  fetchScanHistory: (...args: unknown[]) => mockFetchScanHistory(...args),
  setRoutineFeedback: (...args: unknown[]) => mockSetRoutineFeedback(...args),
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: mockPush }),
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
    skinAge: null,
    skinAgeConfidence: null,
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

test('requests the latest ten scans (trend + personalization)', async () => {
  mockFetchScanHistory.mockResolvedValue([scan('s1')]);
  await render(<ResultRoute />);
  await waitFor(() => expect(mockFetchScanHistory).toHaveBeenCalledWith(10));
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

test('shows the personal card once MIN_SCANS non-stub priors exist and a dimension deviates', async () => {
  // Priors: redness 0.4 across 3 non-stub scans (spread → floor 0.05).
  // Latest: redness 0.9 → z = 10 → above, unfavorable → message renders.
  mockFetchScanHistory.mockResolvedValue([
    scan('s1', { isStub: false, scores: { ...scores, redness: 0.9 } }),
    scan('s2', { isStub: false, scores: { ...scores, redness: 0.4 } }),
    scan('s3', { isStub: false, scores: { ...scores, redness: 0.4 } }),
    scan('s4', { isStub: false, scores: { ...scores, redness: 0.4 } }),
  ]);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText(/redness is up compared to your usual/i)).toBeTruthy());
  expect(screen.getAllByText(/compared to your usual/i).length > 0).toBe(true);
});

test('cold start (too few priors) renders no personal card', async () => {
  mockFetchScanHistory.mockResolvedValue([
    scan('s1', { isStub: false }),
    scan('s2', { isStub: false }),
  ]);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText(/not a medical diagnosis/i)).toBeTruthy());
  expect(screen.queryByText(/compared to your usual/i)).toBeNull();
});

test('stub priors never teach the baseline (no personal card)', async () => {
  // 3 priors exist but all stubs → baseline null → cold-start UI.
  mockFetchScanHistory.mockResolvedValue([
    scan('s1', { isStub: false, scores: { ...scores, redness: 0.9 } }),
    scan('s2'), // isStub: true by default
    scan('s3'),
    scan('s4'),
  ]);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText(/not a medical diagnosis/i)).toBeTruthy());
  expect(screen.queryByText(/compared to your usual/i)).toBeNull();
});

test('trend card receives at most 5 scans even when more history is fetched', async () => {
  // AgeTrendCard is gated behind premium entitlement; unlock it so the trend headline renders.
  setEntitlementSource(localStubEntitlement(true));
  try {
    // 7 scans; the 6th and 7th have extreme hydration that WOULD flip the aggregate trend
    // if they entered the freshness baseline — the cap keeps them out.
    mockFetchScanHistory.mockResolvedValue([
      scan('s1'), scan('s2'), scan('s3'), scan('s4'), scan('s5'),
      scan('s6', { scores: { ...scores, hydration: 0.0 } }),
      scan('s7', { scores: { ...scores, hydration: 0.0 } }),
    ]);
    await render(<ResultRoute />);
    await waitFor(() => expect(screen.getByText(/not a medical diagnosis/i)).toBeTruthy());
    // All 5 in-window scans are identical → freshness delta 0 → steady headline.
    expect(screen.getByText(/looks steady/i)).toBeTruthy();
  } finally {
    setEntitlementSource(localStubEntitlement(false));
  }
});

test('shows the feedback prompt when a prior scan exists and feedback is unanswered', async () => {
  mockSetRoutineFeedback.mockResolvedValue(undefined);
  mockFetchScanHistory.mockResolvedValue([
    scan('s1', { routineHelpful: null }), // latest, unanswered
    scan('s2', { routineHelpful: null }), // a prior scan -> history.length > 1
  ]);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText('Did your routine help?')).toBeTruthy());

  fireEvent.press(screen.getByText('It helped'));
  await waitFor(() => expect(mockSetRoutineFeedback).toHaveBeenCalledWith('s1', 'helped'));
  await waitFor(() => expect(screen.queryByText('Did your routine help?')).toBeNull());
});

test('hides the feedback prompt on the first scan (no prior scan to compare)', async () => {
  mockFetchScanHistory.mockResolvedValue([scan('s1', { routineHelpful: null })]);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText(/not a medical diagnosis/i)).toBeTruthy());
  expect(screen.queryByText('Did your routine help?')).toBeNull();
});

test('hides the feedback prompt when feedback was already given', async () => {
  mockFetchScanHistory.mockResolvedValue([
    scan('s1', { routineHelpful: 'helped' }),
    scan('s2', { routineHelpful: null }),
  ]);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText(/not a medical diagnosis/i)).toBeTruthy());
  expect(screen.queryByText('Did your routine help?')).toBeNull();
});

// Last in the file: this test taps a button (synchronous fireEvent) whose unsettled React work can
// leak into a following test under this repo's no-act-env config, so it runs after the others.
test('the re-scan button navigates to /scan', async () => {
  mockFetchScanHistory.mockResolvedValue([scan('s1')]);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText('Scan again')).toBeTruthy());
  fireEvent.press(screen.getByText('Scan again'));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/scan'));
});
