import { render } from '@testing-library/react-native';
import { SeasonalReport } from '../SeasonalReport';
import { PickedForYou } from '../PickedForYou';
import { ShadeTwins } from '../ShadeTwins';

test('SeasonalReport shows scan progress', async () => {
  const view = await render(<SeasonalReport scansDone={2} total={5} />);
  expect(view.getByText('Seasonal report')).toBeTruthy();
  expect(view.getByText('2 of 5 scans logged')).toBeTruthy();
});

test('PickedForYou renders a rail of items', async () => {
  const view = await render(
    <PickedForYou
      items={[
        { id: 'a', name: 'Soft rose blush' },
        { id: 'b', name: 'Setting mist' },
      ]}
    />,
  );
  expect(view.getByText('Picked for you')).toBeTruthy();
  expect(view.getByText('Soft rose blush')).toBeTruthy();
});

test('ShadeTwins shows the teaser count', async () => {
  const view = await render(<ShadeTwins count={12} />);
  expect(view.getByText('Shade twins')).toBeTruthy();
  expect(view.getByText('12 people share your shade match')).toBeTruthy();
});
