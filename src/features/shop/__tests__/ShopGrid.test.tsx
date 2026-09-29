// v3 Shop grid: search, category chips, sort toggle, 2-col tiles, bag button, scan prompt.
// Fit is a tier word only; there is no "Top rated" sort (no review data).
import { render, fireEvent } from '@testing-library/react-native';
import { ShopGrid } from '../ShopGrid';
import { bag } from '../../checkout/bag-store';
import { catalog } from '../../match/product-catalog';
import type { MatchProfile } from '../../match/match-types';

const PROFILE: MatchProfile = { shade: 6, undertone: 'warm', coverage: 'everyday', skips: [] };
const handlers = () => ({ onOpen: jest.fn(), onScan: jest.fn(), onBag: jest.fn() });

beforeEach(() => bag.clear());

test('pre-scan: neutral "Featured" shelf with a scan prompt and no tiers', async () => {
  const h = handlers();
  const view = await render(<ShopGrid {...h} />);
  expect(view.getByTestId('sort-label')).toHaveTextContent('Featured');
  expect(view.queryAllByTestId('fit-tier')).toHaveLength(0);
  await fireEvent.press(view.getByRole('button', { name: 'See your fit on every product' }));
  expect(h.onScan).toHaveBeenCalled();
  expect(view.queryAllByText(/%|★|top rated|review/i)).toHaveLength(0);
});

test('post-scan: "Best match" sort, tiers, one best-match badge, no scan prompt', async () => {
  const view = await render(<ShopGrid profile={PROFILE} {...handlers()} />);
  expect(view.getByTestId('sort-label')).toHaveTextContent('Best match');
  expect(view.getAllByTestId('fit-tier').length).toBeGreaterThan(0);
  expect(view.getAllByTestId('best-match-badge')).toHaveLength(1);
  expect(view.queryByRole('button', { name: 'See your fit on every product' })).toBeNull();
});

test('category chip + search narrow the grid and the count follows', async () => {
  const view = await render(<ShopGrid {...handlers()} />);
  await fireEvent.press(view.getByRole('button', { name: 'Lips' }));
  const lips = catalog.filter((p) => p.category === 'lips');
  expect(view.getByText(`${lips.length} products`)).toBeTruthy();
  await fireEvent.changeText(view.getByPlaceholderText('Search products'), 'zzzz');
  expect(view.getByText('No results')).toBeTruthy();
});

test('sort toggles to price, and tapping a tile opens it', async () => {
  const h = handlers();
  const view = await render(<ShopGrid {...h} />);
  await fireEvent.press(view.getByRole('button', { name: /Sort by/ }));
  expect(view.getByTestId('sort-label')).toHaveTextContent('Price: low to high');
  const first = view.getAllByTestId(/^product-/)[0];
  await fireEvent.press(first);
  expect(h.onOpen).toHaveBeenCalledWith(expect.any(String));
});

test('bag button shows the count and opens the bag', async () => {
  const h = handlers();
  bag.add(catalog[0], 2);
  const view = await render(<ShopGrid {...h} />);
  await fireEvent.press(view.getByRole('button', { name: 'Bag, 2 items' }));
  expect(h.onBag).toHaveBeenCalled();
});
