// v3 For You home parts (designer video t-01..t-03, t-06): a search row with a
// sort-and-filter button, four quick actions (Seasonal carries a NEW badge) and photo
// category shortcuts incl. Cheeks.
import { render, fireEvent } from '@testing-library/react-native';
import { HomeSearch, QuickActions, Categories, SectionHead } from '../HomeV3Parts';

test('search row opens the shop search, and the filter button opens sort & filter', async () => {
  const onOpen = jest.fn();
  const onFilter = jest.fn();
  const view = await render(<HomeSearch onOpen={onOpen} onFilter={onFilter} />);
  expect(view.getByText('Search products, shades, brands')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Search products' }));
  expect(onOpen).toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: 'Sort and filter' }));
  expect(onFilter).toHaveBeenCalled();
});

test('four quick actions in video order; Seasonal is badged NEW', async () => {
  const go = jest.fn();
  const onSeasonal = jest.fn();
  const view = await render(<QuickActions onGo={go} onSeasonal={onSeasonal} />);
  for (const name of ['Shade match', 'Routine', 'Shade twins']) {
    await fireEvent.press(view.getByRole('button', { name }));
  }
  expect(go.mock.calls.map((c) => c[0])).toEqual(['/scan-gate', '/routine', '/community']);
  await fireEvent.press(view.getByRole('button', { name: 'Seasonal, new' }));
  expect(onSeasonal).toHaveBeenCalled();
  expect(view.getByText('NEW')).toBeTruthy();
});

test('categories: Face, Eyes, Lips, Cheeks, All — each opens the shop on that category', async () => {
  const go = jest.fn();
  const view = await render(<Categories onGo={go} />);
  for (const name of ['Face', 'Eyes', 'Lips', 'Cheeks', 'All']) {
    await fireEvent.press(view.getByRole('button', { name }));
  }
  expect(go.mock.calls.map((c) => c[0])).toEqual([
    '/shop?cat=face',
    '/shop?cat=eyes',
    '/shop?cat=lips',
    '/shop?cat=cheeks',
    '/shop?cat=all',
  ]);
  // Four photo circles (All is the drawn grid tile).
  expect(view.getAllByTestId(/^category-photo-/)).toHaveLength(4);
});

test('section head shows a title, optional subtitle and a See all action', async () => {
  const onAction = jest.fn();
  const view = await render(<SectionHead title="Categories" sub="Ranked for Warm Sand" onAction={onAction} />);
  expect(view.getByText('Categories')).toBeTruthy();
  expect(view.getByText('Ranked for Warm Sand')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'See all Categories' }));
  expect(onAction).toHaveBeenCalled();
});
