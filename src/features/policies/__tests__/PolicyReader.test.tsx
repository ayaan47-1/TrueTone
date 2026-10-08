import { render } from '@testing-library/react-native';
import { PolicyReader } from '../PolicyReader';

test('renders the substantive Markdown policy body instead of a placeholder', async () => {
  const { getByText, queryByText } = await render(<PolicyReader docKey="privacy" />);

  expect(getByText('The waitlist')).toBeTruthy();
  expect(getByText(/If you join the early-access list/i)).toBeTruthy();
  expect(queryByText(/PLACEHOLDER/i)).toBeNull();
});

test('renders retention schedule bullets from Draft A', async () => {
  const { getByText } = await render(<PolicyReader docKey="retention" />);

  expect(getByText(/The photo is processed only on your device and deleted immediately/i)).toBeTruthy();
  expect(getByText(/Any restorable backup copy ages out within 7 days/i)).toBeTruthy();
});
