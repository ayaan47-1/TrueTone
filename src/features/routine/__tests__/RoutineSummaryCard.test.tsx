import { render, fireEvent } from '@testing-library/react-native';
import { RoutineSummaryCard } from '../components/RoutineSummaryCard';

test('shows the streak and today counts', async () => {
  const view = await render(
    <RoutineSummaryCard summary={{ amCount: 2, pmCount: 1, todayCount: 3, streak: 4 }} />,
  );
  expect(view.getByText('4-day streak')).toBeTruthy();
  expect(view.getByText('2 AM · 1 PM logged today')).toBeTruthy();
});

test('prompts when nothing is logged and there is no streak', async () => {
  const view = await render(
    <RoutineSummaryCard summary={{ amCount: 0, pmCount: 0, todayCount: 0, streak: 0 }} />,
  );
  expect(view.getByText('Start your streak today')).toBeTruthy();
  expect(view.getByText('Nothing logged yet today')).toBeTruthy();
});

test('fires onPress when tapped', async () => {
  const onPress = jest.fn();
  const view = await render(
    <RoutineSummaryCard summary={{ amCount: 0, pmCount: 0, todayCount: 0, streak: 0 }} onPress={onPress} />,
  );
  await fireEvent.press(view.getByTestId('routine-summary'));
  expect(onPress).toHaveBeenCalledTimes(1);
});
