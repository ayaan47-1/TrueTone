import { render, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { Onboarding } from '../Onboarding';

beforeEach(() => jest.clearAllMocks());

test('shows not-a-medical-device disclaimer, no efficacy/equity claim', async () => {
  const { getByText, queryByText } = await render(<Onboarding />);
  expect(getByText(/not a medical device/i)).toBeTruthy();
  expect(getByText(/dermatologist/i)).toBeTruthy();
  expect(queryByText(/clinically proven|validated across|dermatologist-level/i)).toBeNull();
});

test('the primary CTA routes to the scan flow', async () => {
  const { getByText } = await render(<Onboarding />);
  fireEvent.press(getByText('Start your read'));
  expect(mockPush).toHaveBeenCalledWith('/scan');
});
