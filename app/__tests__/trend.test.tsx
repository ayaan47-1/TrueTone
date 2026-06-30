import { render, waitFor, fireEvent } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

const mockFetchHistory = jest.fn();
jest.mock('../../src/lib/scans', () => ({ fetchScanHistory: () => mockFetchHistory() }));

import TrendScreen from '../(tabs)/trend';

const scan = (id: string, capturedAt: string, skinType = 'dry') => ({
  id,
  capturedAt,
  skinType,
  scores: {},
  modelVersion: 'stub-1',
  isStub: true,
  routine: { version: 'v1', am: [], pm: [], notes: [] },
  skinAge: null,
  skinAgeConfidence: null,
  routineHelpful: null,
});

beforeEach(() => jest.clearAllMocks());

test('renders the empty state when there are no reads', async () => {
  mockFetchHistory.mockResolvedValue([]);
  const view = await render(<TrendScreen />);
  await waitFor(() => expect(view.getByText(/take a few reads/i)).toBeTruthy());
});

test('lists recent reads with their dates when history exists', async () => {
  mockFetchHistory.mockResolvedValue([
    scan('s2', '2026-06-24T09:00:00.000Z'),
    scan('s1', '2026-06-20T09:00:00.000Z'),
  ]);
  const view = await render(<TrendScreen />);
  await waitFor(() => expect(view.getByText(/Jun 2[34]/)).toBeTruthy());
  expect(view.getByText(/Jun 2[01]/)).toBeTruthy();
});

test('shows an error state when the fetch fails', async () => {
  mockFetchHistory.mockRejectedValue(new Error('network'));
  const view = await render(<TrendScreen />);
  await waitFor(() => expect(view.getByText(/couldn.t load your trend/i)).toBeTruthy());
});

test('retry button refetches and recovers from an error', async () => {
  mockFetchHistory
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce([scan('s1', '2026-06-24T09:00:00.000Z')]);
  const view = await render(<TrendScreen />);
  await waitFor(() => expect(view.getByText(/couldn.t load your trend/i)).toBeTruthy());
  fireEvent.press(view.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(view.getByText(/Jun 2[34]/)).toBeTruthy());
});
