import { render, screen, waitFor, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

let mockDemoMode = false;
jest.mock('../../src/lib/supabase', () => ({
  get DEMO_MODE() {
    return mockDemoMode;
  },
}));

jest.mock('../../src/lib/profile-context', () => ({
  useProfile: () => ({ userId: 'u1' }),
}));

import RoutineRoute from '../routine';

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

beforeEach(async () => {
  jest.clearAllMocks();
  mockDemoMode = false;
  await AsyncStorage.clear();
});

test('renders the latest scan routine', async () => {
  mockFetchScanHistory.mockResolvedValue([scan('s1')]);
  await render(<RoutineRoute />);
  await waitFor(() => expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy());
});

// Root cause of "stuck on Couldn't load your routine": the page was ONLY the backend scan
// routine, so an unreachable backend replaced the whole page, and "pull to retry" was plain text
// with no refresh control behind it. Now the user's own routine always renders, the scan
// suggestions fail inline, and both Try again and pull-to-refresh actually refetch.
test('a failed scan fetch does not block the page: the editable routine still renders', async () => {
  mockFetchScanHistory.mockRejectedValue(new Error('network'));
  await render(<RoutineRoute />);
  expect(await screen.findByText(/couldn.t load suggestions/i)).toBeTruthy();
  expect(screen.getByTestId('routine-add-am')).toBeTruthy();
});

test('Try again refetches and recovers', async () => {
  mockFetchScanHistory.mockRejectedValueOnce(new Error('network')).mockResolvedValue([scan('s1')]);
  await render(<RoutineRoute />);
  await fireEvent.press(await screen.findByText(/try again/i));
  await waitFor(() => expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy());
  expect(mockFetchScanHistory).toHaveBeenCalledTimes(2);
});

test('pull to refresh refetches the scan suggestions', async () => {
  mockFetchScanHistory.mockRejectedValueOnce(new Error('network')).mockResolvedValue([scan('s1')]);
  await render(<RoutineRoute />);
  await screen.findByText(/couldn.t load suggestions/i);
  await act(async () => {
    await screen.getByTestId('routine-scroll').props.refreshControl.props.onRefresh();
  });
  await waitFor(() => expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy());
});

test('an older, slower fetch never overwrites a newer result', async () => {
  let rejectFirst: (e: Error) => void = () => {};
  mockFetchScanHistory
    .mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject; }))
    .mockResolvedValue([scan('s1')]);
  await render(<RoutineRoute />);
  await act(async () => {
    await screen.getByTestId('routine-scroll').props.refreshControl.props.onRefresh();
  });
  await waitFor(() => expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy());
  await act(async () => rejectFirst(new Error('late network error')));
  expect(screen.queryByText(/couldn.t load suggestions/i)).toBeNull();
  expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy();
});

test('pull to refresh keeps the current suggestions on screen while it refetches', async () => {
  mockFetchScanHistory.mockResolvedValueOnce([scan('s1')]).mockImplementation(() => new Promise(() => {}));
  await render(<RoutineRoute />);
  await waitFor(() => expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy());
  await act(async () => {
    void screen.getByTestId('routine-scroll').props.refreshControl.props.onRefresh();
  });
  expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy();
  expect(screen.queryByText(/loading suggestions/i)).toBeNull();
});

test('demo builds have no backend: never fetch, never show an error', async () => {
  mockDemoMode = true;
  await render(<RoutineRoute />);
  expect(await screen.findByTestId('routine-add-am')).toBeTruthy();
  expect(mockFetchScanHistory).not.toHaveBeenCalled();
  expect(screen.queryByText(/couldn.t load/i)).toBeNull();
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
  const button = await screen.findByText(/why these/i);
  fireEvent.press(button);
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/scan/chat', params: { scanId: 's1' } });
});
