// "Running low" (kit RunningLow3): sample items with a Reorder button that adds the
// product to the bag.
import { render, fireEvent } from '@testing-library/react-native';
import { RunningLowCard } from '../RunningLowCard';
import { SAMPLE_RUNNING_LOW, SAMPLE_RUNNING_LOW_LABEL } from '../home-sample-data';
import { bag } from '../../checkout/bag-store';

beforeEach(() => bag.clear());

test('lists each sample item with its note and a Reorder button', async () => {
  const view = await render(<RunningLowCard />);
  expect(view.getByText('Buy Again')).toBeTruthy();
  expect(view.getByText('Restock before you run out')).toBeTruthy();
  expect(SAMPLE_RUNNING_LOW.length).toBe(2);
  for (const item of SAMPLE_RUNNING_LOW) {
    expect(view.getByText(item.product.name)).toBeTruthy();
    expect(view.getByText(item.note)).toBeTruthy();
  }
});

test('Reorder adds that product to the bag', async () => {
  const view = await render(<RunningLowCard />);
  const first = SAMPLE_RUNNING_LOW[0].product;
  await fireEvent.press(view.getByRole('button', { name: `Reorder ${first.name}` }));
  expect(bag.getState().lines.map((l) => l.product.id)).toEqual([first.id]);
});

test('shows a visible sample label so the stock notes are not read as real', async () => {
  const view = await render(<RunningLowCard />);
  expect(SAMPLE_RUNNING_LOW_LABEL).toMatch(/^Sample/);
  expect(view.getByText(SAMPLE_RUNNING_LOW_LABEL)).toBeTruthy();
});
