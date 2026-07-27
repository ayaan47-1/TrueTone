import { render, fireEvent } from '@testing-library/react-native';
import { MoodPicker } from '../MoodPicker';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test('renders the four Quiet Glass skin-feel options', async () => {
  const view = await render(<MoodPicker value={null} onSelect={() => {}} />);
  ['Calm', 'Glowy', 'Dry', 'Tired'].forEach((label) =>
    expect(view.getByText(label)).toBeTruthy(),
  );
});

test('calls onSelect with the mood value when a chip is tapped', async () => {
  const onSelect = jest.fn();
  const view = await render(<MoodPicker value={null} onSelect={onSelect} />);
  fireEvent.press(view.getByRole('button', { name: 'Glowy' }));
  expect(onSelect).toHaveBeenCalledWith('glowy');
  await flush();
});

test('marks the selected mood for accessibility', async () => {
  const view = await render(<MoodPicker value="glowy" onSelect={() => {}} />);
  expect(view.getByRole('button', { name: 'Glowy' }).props.accessibilityState).toMatchObject({
    selected: true,
  });
  expect(view.getByRole('button', { name: 'Calm' }).props.accessibilityState).toMatchObject({
    selected: false,
  });
});
