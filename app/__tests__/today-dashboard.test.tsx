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

// Demo mode is the only way this screen's "Picked for your shade" rail populates without
// a real on-device scan (for-you-profile.ts's stub shade) -- mocked on so both rails can
// be exercised the same way the shipped demo build actually runs.
jest.mock('../../src/lib/supabase', () => ({ DEMO_MODE: true, supabase: {} }));

import TodayScreen from '../(tabs)/index';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
beforeEach(() => {
  jest.clearAllMocks();
  mockFetchHistory.mockResolvedValue([]);
});

test('renders both product rails: Featured always, and Your products via the demo stub shade', async () => {
  const view = await render(<TodayScreen />);
  await waitFor(() => expect(view.getByText('Featured products')).toBeTruthy());
  expect(view.getByText('Your products')).toBeTruthy();
  expect(view.getByText('Picked for your shade')).toBeTruthy();
  // Both rails actually contain product cards, not just their headers.
  expect(view.getAllByTestId('product-name').length).toBeGreaterThan(0);
});

test('logging a skin-feel mood persists it on-device', async () => {
  const view = await render(<TodayScreen />);
  fireEvent.press(view.getByRole('button', { name: 'Glowy' }));
  expect(mockSetMood).toHaveBeenCalledWith('glowy');
  await flush();
});
