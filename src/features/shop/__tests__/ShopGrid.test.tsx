// v3 Shop grid: search, category chips, sort toggle, 2-col tiles, bag button, scan prompt.
// Fit is a tier word only; "Top rated" + ratings exist only behind SAMPLE_RATINGS_ENABLED.
import { render, fireEvent } from '@testing-library/react-native';
import { ShopGrid } from '../ShopGrid';
import { bag } from '../../checkout/bag-store';
import { catalog } from '../../match/product-catalog';
import type { MatchProfile } from '../../match/match-types';

const PROFILE: MatchProfile = { shade: 6, undertone: 'warm', coverage: 'everyday', skips: [] };
const count = (n: number): string => `${n} ${n === 1 ? 'product' : 'products'}`;
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
  expect(view.getByText(count(lips.length))).toBeTruthy();
  await fireEvent.changeText(view.getByPlaceholderText('Search products, shades, brands'), 'zzzz');
  expect(view.getByText('No results')).toBeTruthy();
});

test('sort label opens the sheet; picking Price re-sorts, and tapping a tile opens it', async () => {
  const h = handlers();
  const view = await render(<ShopGrid {...h} />);
  await fireEvent.press(view.getByRole('button', { name: /Sort by/ }));
  await fireEvent.press(view.getByRole('button', { name: 'Price' }));
  await fireEvent.press(view.getByRole('button', { name: 'Show results' }));
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

test('opens on the category it was sent to (home category shortcuts)', async () => {
  const view = await render(<ShopGrid initialFilter="eyes" {...handlers()} />);
  const eyes = catalog.filter((p) => p.category === 'eyes');
  expect(view.getByText(count(eyes.length))).toBeTruthy();
});

test('shows the one-time sample catalog label', async () => {
  const view = await render(<ShopGrid {...handlers()} />);
  expect(view.getAllByText('Sample catalog — products and images are for demonstration only.')).toHaveLength(1);
});

test('filter button opens Sort & filter; a finish narrows the grid', async () => {
  const view = await render(<ShopGrid {...handlers()} />);
  await fireEvent.press(view.getByRole('button', { name: 'Sort and filter' }));
  await fireEvent.press(view.getByRole('button', { name: 'Satin' }));
  await fireEvent.press(view.getByRole('button', { name: 'Show results' }));
  const satin = catalog.filter((p) => p.category !== 'prep' && p.finish === 'satin');
  expect(view.getByText(count(satin.length))).toBeTruthy();
});

test('the saved heart in the header shows only saved products', async () => {
  const view = await render(<ShopGrid {...handlers()} />);
  await fireEvent.press(view.getByRole('button', { name: `Save ${catalog[0].name}` }));
  await fireEvent.press(view.getByRole('button', { name: /^Saved items/ }));
  expect(view.getByText('1 product')).toBeTruthy();
});
