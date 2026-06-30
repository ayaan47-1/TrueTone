import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

const mockFetchHistory = jest.fn();
jest.mock('../../src/lib/scans', () => ({ fetchScanHistory: () => mockFetchHistory() }));

const mockGetMood = jest.fn(() => Promise.resolve(null));
const mockSetMood = jest.fn((_v?: string) => Promise.resolve());
jest.mock('../../src/features/diary/diary-storage', () => ({
  getMood: () => mockGetMood(),
  setMood: (v: string) => mockSetMood(v),
}));

import TodayScreen from '../(tabs)/index';

const SCAN = {
  id: 's1',
  capturedAt: '2026-06-24T09:00:00.000Z',
  skinType: 'dry',
  scores: {},
  modelVersion: 'stub-1',
  isStub: true,
  routine: { version: 'v1', am: [{}, {}, {}], pm: [{}, {}], notes: [] },
  skinAge: null,
  skinAgeConfidence: null,
  routineHelpful: null,
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
beforeEach(() => jest.clearAllMocks());

test('with a scan, shows the routine summary with step counts and links to Routine', async () => {
  mockFetchHistory.mockResolvedValue([SCAN]);
  const view = await render(<TodayScreen />);
  await waitFor(() => expect(view.getByText(/your routine is ready/i)).toBeTruthy());
  expect(view.getByText(/3 morning · 2 evening steps/i)).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Open your routine' }));
  expect(mockPush).toHaveBeenCalledWith('/routine');
  await flush();
});

test('with no scans, shows the first-read empty state', async () => {
  mockFetchHistory.mockResolvedValue([]);
  const view = await render(<TodayScreen />);
  await waitFor(() => expect(view.getByText(/take your first read/i)).toBeTruthy());
});

test('when the scan fetch fails, shows a distinct error (not the empty state)', async () => {
  mockFetchHistory.mockRejectedValue(new Error('network'));
  const view = await render(<TodayScreen />);
  await waitFor(() => expect(view.getByText(/couldn.t load your scans/i)).toBeTruthy());
  expect(view.queryByText(/take your first read/i)).toBeNull();
});

test('logging a skin-feel mood persists it on-device', async () => {
  mockFetchHistory.mockResolvedValue([]);
  const view = await render(<TodayScreen />);
  fireEvent.press(view.getByRole('button', { name: 'Good' }));
  expect(mockSetMood).toHaveBeenCalledWith('good');
  await flush();
});
