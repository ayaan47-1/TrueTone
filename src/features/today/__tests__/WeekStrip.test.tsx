import { render } from '@testing-library/react-native';
import { WeekStrip } from '../WeekStrip';

test('renders the seven weekday labels', async () => {
  const view = await render(
    <WeekStrip today={new Date(2026, 5, 24)} scanDateKeys={['2026-06-22']} />,
  );
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d) =>
    expect(view.getByText(d)).toBeTruthy(),
  );
});

test('shows the day number for days without a scan', async () => {
  const view = await render(<WeekStrip today={new Date(2026, 5, 24)} scanDateKeys={[]} />);
  // 24th is today (Wed) with no scan → its number shows.
  expect(view.getByText('24')).toBeTruthy();
});
