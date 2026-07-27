import { render } from '@testing-library/react-native';
import { WeekStrip } from '../WeekStrip';

test('renders the seven compact weekday markers', async () => {
  const view = await render(
    <WeekStrip today={new Date(2026, 5, 24)} scanDateKeys={['2026-06-22']} />,
  );
  expect(view.getAllByText('S')).toHaveLength(2);
  expect(view.getAllByText('T')).toHaveLength(2);
  ['M', 'W', 'F'].forEach((d) => expect(view.getByText(d)).toBeTruthy());
});

test('marks today accessibly without showing a numeric score or date', async () => {
  const view = await render(<WeekStrip today={new Date(2026, 5, 24)} scanDateKeys={[]} />);
  expect(view.getByLabelText('Wed, today')).toBeTruthy();
  expect(view.queryByText('24')).toBeNull();
});
