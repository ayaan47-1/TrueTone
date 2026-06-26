// app/__tests__/result-route-hardened.test.tsx
// Covers result.tsx branches 78 and 91:
//   Line 78: PrimaryButton "Back to Home" onPress in the error state → router.replace('/')
//   Line 91: PrimaryButton "Back to Home" onPress in the empty state  → router.replace('/')
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { DIMENSIONS } from '../../src/content/cosmetic-vocab';
import type { ScoreVector } from '../../src/features/read/read-types';

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
    routineHelpful: null,
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

// ─── line 78: error state "Back to Home" button ───────────────────────────────

test('error state "Back to Home" calls router.replace("/") (result.tsx:78)', async () => {
  mockFetchScanHistory.mockRejectedValue(new Error('network error'));
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText(/couldn.t load your read/i)).toBeTruthy());
  fireEvent.press(screen.getByText(/back to home/i));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
});

// ─── line 91: empty state "Back to Home" button ───────────────────────────────

test('empty state "Back to Home" calls router.replace("/") (result.tsx:91)', async () => {
  mockFetchScanHistory.mockResolvedValue([]);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText(/no scan yet/i)).toBeTruthy());
  fireEvent.press(screen.getByText(/back to home/i));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
});

// ─── toSkinTypeFeel fallback branch ──────────────────────────────────────────

test('unknown skinType falls back to combination', async () => {
  mockFetchScanHistory.mockResolvedValue([scan('s1', { skinType: 'unknown_value' })]);
  await render(<ResultRoute />);
  // Skin type label is rendered as 'Combination' even for unknown DB value
  await waitFor(() => expect(screen.getByText(/skin type feel: combination/i)).toBeTruthy());
});

// ─── feedback prompt dismissed via onDone ────────────────────────────────────

// This must be LAST in the file: the synchronous fireEvent.press leaks unsettled
// React work under this repo's no-act-env config, which can cause spurious timeouts
// in subsequent tests.
test('feedback prompt hides after a successful submission (onDone clears needsFeedback)', async () => {
  mockSetRoutineFeedback.mockResolvedValue(undefined);
  mockFetchScanHistory.mockResolvedValue([
    scan('s1', { routineHelpful: null }),
    scan('s2', { routineHelpful: null }),
  ]);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText('Did your routine help?')).toBeTruthy());
  fireEvent.press(screen.getByText('No change'));
  await waitFor(() => expect(mockSetRoutineFeedback).toHaveBeenCalledWith('s1', 'no_change'));
  await waitFor(() => expect(screen.queryByText('Did your routine help?')).toBeNull());
});
