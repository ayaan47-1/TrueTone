import { render, fireEvent } from '@testing-library/react-native';
import { ListRow } from '../ListRow';

test('renders its label and optional caption', async () => {
  const view = await render(<ListRow label="Your Data" caption="View & delete" onPress={() => {}} />);
  expect(view.getByText('Your Data')).toBeTruthy();
  expect(view.getByText('View & delete')).toBeTruthy();
});

test('calls onPress when tapped', async () => {
  const onPress = jest.fn();
  const view = await render(<ListRow label="Policies" onPress={onPress} />);
  fireEvent.press(view.getByRole('button'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('exposes the label as its accessibility name', async () => {
  const view = await render(<ListRow label="Account" onPress={() => {}} />);
  expect(view.getByRole('button').props.accessibilityLabel).toBe('Account');
});
