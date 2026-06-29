import { render, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

import TodayScreen from '../(tabs)/index';
import TrendScreen from '../(tabs)/trend';
import YouScreen from '../(tabs)/you';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => jest.clearAllMocks());

test('Today shows the disclaimer and starts a scan', async () => {
  const view = await render(<TodayScreen />);
  expect(view.getByText(/not a medical device/i)).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Start your read' }));
  expect(mockPush).toHaveBeenCalledWith('/scan');
  await flush();
});

test('Trend renders its empty-state shell', async () => {
  const view = await render(<TrendScreen />);
  expect(view.getByText('Trend')).toBeTruthy();
});

test('You surfaces the data-rights and policies routes', async () => {
  const view = await render(<YouScreen />);
  fireEvent.press(view.getByRole('button', { name: 'Your Data' }));
  expect(mockPush).toHaveBeenCalledWith('/data');
  await flush();
  fireEvent.press(view.getByRole('button', { name: 'Privacy & Policies' }));
  expect(mockPush).toHaveBeenCalledWith('/policies');
  await flush();
});
