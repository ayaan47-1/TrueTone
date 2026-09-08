import { render } from '@testing-library/react-native';
import { ShadeCard } from '../ShadeCard';
import { TodaysPick } from '../TodaysPick';
import { FinishYourLook } from '../FinishYourLook';
import { RunningLow } from '../RunningLow';

test('ShadeCard renders the shade name and descriptors', async () => {
  const view = await render(
    <ShadeCard shadeName="Warm Almond" undertone="Warm undertone" depth="Medium depth" finish="Natural finish" />,
  );
  expect(view.getByText('Warm Almond')).toBeTruthy();
  expect(view.getByText('Your shade')).toBeTruthy();
  expect(view.getByText('Warm undertone')).toBeTruthy();
});

test('ShadeCard exposes a Rescan control when given a handler', async () => {
  const view = await render(<ShadeCard shadeName="Soft Beige" onRescan={() => {}} />);
  expect(view.getByRole('button', { name: /rescan/i })).toBeTruthy();
});

test('TodaysPick hides the pick until revealed', async () => {
  const hidden = await render(<TodaysPick pickLabel="Soft rose blush" revealed={false} onReveal={() => {}} />);
  expect(hidden.getByText(/Today's pick · until midnight/)).toBeTruthy();
  expect(hidden.getByText('Tap to reveal')).toBeTruthy();
  expect(hidden.queryByText('Soft rose blush')).toBeNull();
});

test('TodaysPick shows the pick once revealed', async () => {
  const shown = await render(<TodaysPick pickLabel="Soft rose blush" revealed onReveal={() => {}} />);
  expect(shown.getByText('Soft rose blush')).toBeTruthy();
});

test('FinishYourLook lists items with a live total', async () => {
  const view = await render(
    <FinishYourLook
      items={[
        { id: 'a', name: 'Setting mist', price: '$18' },
        { id: 'b', name: 'Lip tint', price: '$16' },
      ]}
      total="$34"
    />,
  );
  expect(view.getByText('Finish your look')).toBeTruthy();
  expect(view.getByText('Setting mist')).toBeTruthy();
  expect(view.getByText('$34')).toBeTruthy();
});

test('RunningLow lists items and shows an empty state', async () => {
  const filled = await render(<RunningLow items={[{ id: 'a', name: 'Concealer', note: 'Almost out' }]} />);
  expect(filled.getByText('Running low')).toBeTruthy();
  expect(filled.getByText('Concealer')).toBeTruthy();

  const empty = await render(<RunningLow items={[]} />);
  expect(empty.getByText("You're all stocked up.")).toBeTruthy();
});
