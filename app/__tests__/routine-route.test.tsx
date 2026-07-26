import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { DIMENSIONS } from '../../src/content/cosmetic-vocab';
import type { ScoreVector } from '../../src/features/read/read-types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockFetchScanHistory = jest.fn();
jest.mock('../../src/lib/scans', () => ({
  fetchScanHistory: (...args: unknown[]) => mockFetchScanHistory(...args),
}));

import RoutineRoute from '../(tabs)/routine';

const scores = Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ScoreVector;

function scan(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    capturedAt: '2026-07-02T00:00:00Z',
    skinType: 'dry',
    scores,
    modelVersion: 'cv-1',
    isStub: false,
    skinAge: null,
    skinAgeConfidence: null,
    routineHelpful: null,
    captureQuality: 'good',
    routine: {
      version: 'skincare-1',
      am: [
        { category: 'a broad-spectrum SPF 30+ sunscreen', habit: 'am', rationale: 'r', dimensions: [] },
        { category: 'gentle hydrating cleanser', habit: 'am', rationale: 'r', dimensions: ['hydration'] },
      ],
      pm: [],
      notes: [],
    },
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

test('renders the latest scan routine', async () => {
  mockFetchScanHistory.mockResolvedValue([scan('s1')]);
  await render(<RoutineRoute />);
  await waitFor(() => expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy());
});

test('shows a retry state when the fetch fails', async () => {
  mockFetchScanHistory.mockRejectedValue(new Error('network'));
  await render(<RoutineRoute />);
  expect(await screen.findByText(/couldn.t load your routine/i)).toBeTruthy();
});

test('shows the empty state with no scans', async () => {
  mockFetchScanHistory.mockResolvedValue([]);
  await render(<RoutineRoute />);
  expect(await screen.findByText(/no scan yet/i)).toBeTruthy();
});

test('emphasizes routine steps when the user deviates unfavorably from their baseline', async () => {
  // Priors: hydration 0.8 across 3 non-stub scans; latest 0.2 → below, unfavorable
  // → the hydration-driven cleanser step is emphasized and moves first.
  mockFetchScanHistory.mockResolvedValue([
    scan('s1', { scores: { ...scores, hydration: 0.2 } }),
    scan('s2', { scores: { ...scores, hydration: 0.8 } }),
    scan('s3', { scores: { ...scores, hydration: 0.8 } }),
    scan('s4', { scores: { ...scores, hydration: 0.8 } }),
  ]);
  await render(<RoutineRoute />);
  await waitFor(() => expect(screen.getByText(/focus today/i)).toBeTruthy());
});

test('cold start renders the stored routine order with no emphasis', async () => {
  mockFetchScanHistory.mockResolvedValue([scan('s1'), scan('s2')]);
  await render(<RoutineRoute />);
  await waitFor(() => expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy());
  expect(screen.queryByText(/focus today/i)).toBeNull();
});

// Press-heavy test LAST in the file (repo gotcha: unsettled React work leaks forward).
test('navigates to /scan/chat with the scanId when the button is pressed', async () => {
  mockFetchScanHistory.mockResolvedValue([scan('s1')]);
  await render(<RoutineRoute />);
  const button = await screen.findByText(/ask about your routine/i);
  fireEvent.press(button);
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/scan/chat', params: { scanId: 's1' } });
});
