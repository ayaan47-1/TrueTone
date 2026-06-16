import { render } from '@testing-library/react-native';
import { Onboarding } from '../Onboarding';
test('shows not-a-medical-device disclaimer, no efficacy/equity claim', async () => {
  const { getByText, queryByText } = await render(<Onboarding />);
  expect(getByText(/not a medical device/i)).toBeTruthy();
  expect(getByText(/dermatologist/i)).toBeTruthy();
  expect(queryByText(/clinically proven|validated across|dermatologist-level/i)).toBeNull();
});
