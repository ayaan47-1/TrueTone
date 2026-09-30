// v3 grid card. Fit shows as a qualitative tier only — never a number, never a bar — and
// there are no star ratings or review counts (no real review data).
import { render, fireEvent, act } from '@testing-library/react-native';
import { ProductTile } from '../ProductTile';
import { catalog } from '../../match/product-catalog';
import { bag } from '../../checkout/bag-store';

const product = catalog.find((p) => p.id === 'lum-tint-01')!;

beforeEach(() => bag.clear());

test('shows line, title, price and the product photo, with no fit signal pre-scan', async () => {
  const view = await render(<ProductTile product={product} onOpen={jest.fn()} />);
  expect(view.getByText('Lumira')).toBeTruthy();
  expect(view.getByText('Weightless Skin Tint')).toBeTruthy();
  expect(view.getByText('$24')).toBeTruthy();
  expect(view.getByTestId('product-photo')).toBeTruthy();
  expect(view.queryByTestId('fit-tier')).toBeNull();
});

test('post-scan shows the tier label and a best-match badge; never a % or stars', async () => {
  const view = await render(<ProductTile product={product} tier="great" isBestMatch onOpen={jest.fn()} />);
  expect(view.getByTestId('fit-tier')).toHaveTextContent('Great match');
  expect(view.getByTestId('best-match-badge')).toBeTruthy();
  expect(view.queryAllByText(/%/)).toHaveLength(0);
  expect(view.queryAllByText(/★|review/i)).toHaveLength(0);
});

test('tapping the card opens the product', async () => {
  const onOpen = jest.fn();
  const view = await render(<ProductTile product={product} onOpen={onOpen} />);
  fireEvent.press(view.getByRole('button', { name: `Open ${product.name}` }));
  expect(onOpen).toHaveBeenCalledWith(product.id);
});

test('the + button adds the product to the bag and confirms', async () => {
  jest.useFakeTimers();
  const view = await render(<ProductTile product={product} onOpen={jest.fn()} />);
  await fireEvent.press(view.getByRole('button', { name: `Add ${product.name} to bag` }));
  expect(bag.getState().lines).toHaveLength(1);
  expect(view.getByTestId('glyph-check')).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(view.queryByTestId('glyph-check')).toBeNull();
  jest.useRealTimers();
});
