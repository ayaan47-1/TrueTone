// The "Can't connect" screen replaces the whole Stack, so it must give the user a way out:
// a Try again button that re-runs the profile load (it used to say "Pull to retry" with
// no pull or button wired, leaving a kill-the-app dead end).
import { act, render, fireEvent, screen } from '@testing-library/react-native';

const mockRefresh = jest.fn();
const mockUseProfile = jest.fn();
jest.mock('../../src/lib/profile-context', () => ({
  useProfile: () => mockUseProfile(),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  const Stack = Object.assign(() => <Text>stack</Text>, { Screen: () => null });
  return {
    Stack,
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    usePathname: () => '/',
  };
});

jest.mock('../../src/lib/supabase', () => ({ DEMO_MODE: false, supabase: {} }));

import RootLayout from '../_layout';

beforeEach(() => {
  jest.clearAllMocks();
  mockUseProfile.mockReturnValue({ loading: false, error: true, route: 'home', userId: null, refresh: mockRefresh });
});

test('the connection-error screen offers Try again, which re-runs the profile load', async () => {
  await render(<RootLayout />);
  expect(screen.queryByText('stack')).toBeNull();
  expect(screen.queryByText(/Pull to retry/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});

test('Try again is single-flight: repeat taps while a retry runs do not start another load', async () => {
  let finish: () => void = () => {};
  mockRefresh.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  await render(<RootLayout />);
  const retry = screen.getByRole('button', { name: 'Try again' });
  await act(async () => {
    retry.props.onClick({ nativeEvent: {} });
    retry.props.onClick({ nativeEvent: {} });
  });
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  await act(async () => finish());
});

test('while a retry runs the button shows it is working', async () => {
  let finish: () => void = () => {};
  mockRefresh.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  await render(<RootLayout />);
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.getByText('Retrying…')).toBeTruthy();
  await act(async () => finish());
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
});
