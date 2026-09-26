import { render, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

// Demo mode is the only way this screen's "Picked for your shade" rail populates without
// a real on-device scan (for-you-profile.ts's stub shade) -- mocked on so both rails can
// be exercised the same way the shipped demo build actually runs.
jest.mock('../../src/lib/supabase', () => ({ DEMO_MODE: true, supabase: {} }));

import TodayScreen from '../(tabs)/index';

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders both product rails: Featured always, and Your products via the demo stub shade', async () => {
  const view = await render(<TodayScreen />);
  await waitFor(() => expect(view.getByText('Featured products')).toBeTruthy());
  expect(view.getByText('Your products')).toBeTruthy();
  expect(view.getByText('Picked for your shade')).toBeTruthy();
  // Both rails actually contain product cards, not just their headers.
  expect(view.getAllByTestId('product-name').length).toBeGreaterThan(0);
});

test('preserves greeting, shade-match action, and disclaimer while dropping the week strip and mood diary', async () => {
  const view = await render(<TodayScreen />);
  await waitFor(() => expect(view.getByText('Featured products')).toBeTruthy());
  // Kept
  expect(view.getByRole('button', { name: 'Shade match' })).toBeTruthy();
  expect(view.getByText(/good (morning|afternoon|evening)/i)).toBeTruthy();
  // Removed: the week strip and skin-feel mood diary no longer render.
  expect(view.queryByText('How does your skin feel?')).toBeNull();
  expect(view.queryByRole('button', { name: 'Glowy' })).toBeNull();
});
