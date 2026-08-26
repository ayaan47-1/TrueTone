import { render, fireEvent } from '@testing-library/react-native';
import { TextField } from '../TextField';

test('renders label and placeholder', async () => {
  const view = await render(
    <TextField value="" onChangeText={jest.fn()} label="Email" placeholder="you@example.com" />,
  );
  expect(view.getByText('Email')).toBeTruthy();
  expect(view.getByPlaceholderText('you@example.com')).toBeTruthy();
});

test('calls onChangeText when the input changes', async () => {
  const onChangeText = jest.fn();
  const view = await render(
    <TextField value="" onChangeText={onChangeText} placeholder="Type here" />,
  );
  fireEvent.changeText(view.getByPlaceholderText('Type here'), 'hello');
  expect(onChangeText).toHaveBeenCalledWith('hello');
});

test('renders the error message when error is set', async () => {
  const view = await render(
    <TextField value="" onChangeText={jest.fn()} placeholder="Password" error="Required" />,
  );
  expect(view.getByText('Required')).toBeTruthy();
});
