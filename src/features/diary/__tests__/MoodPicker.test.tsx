import { render, fireEvent } from '@testing-library/react-native';
import { MoodPicker } from '../MoodPicker';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test('renders all five skin-feel options', async () => {
  const view = await render(<MoodPicker value={null} onSelect={() => {}} />);
  ['Bad', 'Not great', 'Okay', 'Good', 'Awesome'].forEach((label) =>
    expect(view.getByText(label)).toBeTruthy(),
  );
});

test('calls onSelect with the mood value when a face is tapped', async () => {
  const onSelect = jest.fn();
  const view = await render(<MoodPicker value={null} onSelect={onSelect} />);
  fireEvent.press(view.getByRole('button', { name: 'Good' }));
  expect(onSelect).toHaveBeenCalledWith('good');
  await flush();
});

test('marks the selected mood for accessibility', async () => {
  const view = await render(<MoodPicker value="awesome" onSelect={() => {}} />);
  expect(view.getByRole('button', { name: 'Awesome' }).props.accessibilityState).toMatchObject({
    selected: true,
  });
  expect(view.getByRole('button', { name: 'Bad' }).props.accessibilityState).toMatchObject({
    selected: false,
  });
});
