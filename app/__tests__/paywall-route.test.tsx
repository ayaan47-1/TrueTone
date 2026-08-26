// NOTE: PressableScale (Animated Pressable branch) is not press-dispatchable in this
// jest setup, so this asserts render only — both plan prices and the CTA are present.
// Plan-select state change is exercised by the shipped goals/coverage pattern.

import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

import PaywallScreen from '../paywall';

beforeEach(() => jest.clearAllMocks());

test('renders both plan prices and the free-trial CTA', async () => {
  const view = await render(<PaywallScreen />);
  expect(view.getByText('$39.99/yr')).toBeTruthy();
  expect(view.getByText('$8.99/mo')).toBeTruthy();
  expect(view.getByText('Start free trial')).toBeTruthy();
});
