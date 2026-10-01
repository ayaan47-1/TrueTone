// For You header (video t-01): wordmark lockup, avatar initial, "Hi, <name>", the date,
// and bell + bag icon buttons.
import { render, fireEvent } from '@testing-library/react-native';
import { HomeHeader, greetingName } from '../HomeHeader';

test('greets by name with the date, and the bell and bag buttons fire', async () => {
  const onBell = jest.fn();
  const onBag = jest.fn();
  const view = await render(
    <HomeHeader name="Ayaan" dateLabel="Wednesday, July 17" scanned onBell={onBell} onBag={onBag} />,
  );
  expect(view.getByText('Hi, Ayaan')).toBeTruthy();
  expect(view.getByText('Wednesday, July 17')).toBeTruthy();
  expect(view.getByText('A')).toBeTruthy();
  expect(view.getByTestId('home-lockup')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Notifications' }));
  expect(onBell).toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: 'Bag' }));
  expect(onBag).toHaveBeenCalled();
});

test('without a name it falls back to a neutral greeting', async () => {
  const view = await render(
    <HomeHeader dateLabel="Wednesday, July 17" scanned={false} onBell={jest.fn()} onBag={jest.fn()} />,
  );
  expect(view.getByText('Hi there')).toBeTruthy();
});

test('greetingName capitalises a username and ignores empty ones', () => {
  expect(greetingName('ayaan')).toBe('Ayaan');
  expect(greetingName('  ')).toBeUndefined();
  expect(greetingName(null)).toBeUndefined();
  expect(greetingName('mia_k')).toBe('Mia_k');
});
