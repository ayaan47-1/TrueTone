// v3 For You home parts: a search entry, a STATIC hero card (no carousel, no promo code),
// quick actions (no unshipped "Seasonal" concept) and category shortcuts.
import { render, fireEvent } from '@testing-library/react-native';
import { HeroCard, HomeSearch, QuickActions, Categories } from '../HomeV3Parts';

test('search entry opens the shop', async () => {
  const onOpen = jest.fn();
  const view = await render(<HomeSearch onOpen={onOpen} />);
  await fireEvent.press(view.getByRole('button', { name: 'Search products' }));
  expect(onOpen).toHaveBeenCalled();
});

test('hero pre-scan invites a scan; post-scan names the shade and opens the shop', async () => {
  const onScan = jest.fn();
  const onShop = jest.fn();
  const pre = await render(<HeroCard onScan={onScan} onShop={onShop} />);
  expect(pre.getByText('Find your true shade')).toBeTruthy();
  await fireEvent.press(pre.getByRole('button', { name: 'Start scan' }));
  expect(onScan).toHaveBeenCalled();
  expect(pre.queryAllByText(/%|off|code|TRUE15|seconds/i)).toHaveLength(0);

  const post = await render(<HeroCard shadeName="Medium Warm" onScan={onScan} onShop={onShop} />);
  expect(post.getByText('Medium Warm is your match')).toBeTruthy();
  await fireEvent.press(post.getByRole('button', { name: 'See my matches' }));
  expect(onShop).toHaveBeenCalled();
});

test('quick actions route to scan, routine and community — no Seasonal concept', async () => {
  const go = jest.fn();
  const view = await render(<QuickActions onGo={go} />);
  for (const name of ['Shade match', 'Routine', 'Community']) {
    await fireEvent.press(view.getByRole('button', { name }));
  }
  expect(go.mock.calls.map((c) => c[0])).toEqual(['/scan-gate', '/routine', '/community']);
  expect(view.queryByText(/seasonal|new/i)).toBeNull();
});

test('categories open the shop filtered', async () => {
  const go = jest.fn();
  const view = await render(<Categories onGo={go} />);
  await fireEvent.press(view.getByRole('button', { name: 'Lips' }));
  await fireEvent.press(view.getByRole('button', { name: 'All' }));
  expect(go.mock.calls.map((c) => c[0])).toEqual(['/shop?cat=lips', '/shop?cat=all']);
});
