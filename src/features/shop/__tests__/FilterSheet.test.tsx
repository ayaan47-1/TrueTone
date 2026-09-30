// v3 Sort & filter sheet (frame t-07): SORT BY chips, FINISH chips, Reset / Show results.
import { render, fireEvent } from '@testing-library/react-native';
import { FilterSheet } from '../FilterSheet';

const base = { visible: true, sort: 'match' as const, finish: 'any' as const, scanned: true, onClose: jest.fn() };

test('shows sort + finish chips and applies the picked values on "Show results"', async () => {
  const onApply = jest.fn();
  const view = await render(<FilterSheet {...base} showRatingSort onApply={onApply} />);
  expect(view.getByText('Sort & filter')).toBeTruthy();
  ['Best match', 'Top rated', 'Price', 'Any', 'Natural', 'Satin', 'Dewy', 'Matte'].forEach((l) =>
    expect(view.getByRole('button', { name: l })).toBeTruthy(),
  );
  await fireEvent.press(view.getByRole('button', { name: 'Price' }));
  await fireEvent.press(view.getByRole('button', { name: 'Dewy' }));
  await fireEvent.press(view.getByRole('button', { name: 'Show results' }));
  expect(onApply).toHaveBeenCalledWith('price', 'dewy');
});

test('Reset returns the draft to Best match + Any', async () => {
  const onApply = jest.fn();
  const view = await render(<FilterSheet {...base} sort="price" finish="matte" showRatingSort={false} onApply={onApply} />);
  await fireEvent.press(view.getByRole('button', { name: 'Reset' }));
  await fireEvent.press(view.getByRole('button', { name: 'Show results' }));
  expect(onApply).toHaveBeenCalledWith('match', 'any');
});

test('"Top rated" is hidden while sample ratings are off; pre-scan reads "Featured"', async () => {
  const view = await render(<FilterSheet {...base} scanned={false} showRatingSort={false} onApply={jest.fn()} />);
  expect(view.queryByRole('button', { name: 'Top rated' })).toBeNull();
  expect(view.getByRole('button', { name: 'Featured' })).toBeTruthy();
});
