import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

// Demo mode is the only way this screen's "Picked for your shade" rail populates without
// a real on-device scan (for-you-profile.ts's stub shade) -- mocked on so the rail can be
// exercised the same way the shipped demo build actually runs.
jest.mock('../../src/lib/supabase', () => ({ DEMO_MODE: true, CAMERA_DEMO: false, supabase: {} }));

// The header greets by username, which needs the signed-in userId.
jest.mock('../../src/lib/profile-context', () => ({ useProfile: () => ({ userId: 'demo-user' }) }));

import TodayScreen from '../(tabs)/index';

beforeEach(() => {
  jest.clearAllMocks();
});

async function renderHome() {
  const view = await render(<TodayScreen />);
  await waitFor(() => expect(view.getByText('For You')).toBeTruthy());
  return view;
}

test('v3 video home, top to bottom: header, search, hero, quick actions, categories', async () => {
  const view = await renderHome();
  expect(view.getByText(/^Hi(, \w+| there)$/)).toBeTruthy();
  expect(view.getByRole('button', { name: 'Notifications' })).toBeTruthy();
  expect(view.getByRole('button', { name: 'Bag' })).toBeTruthy();
  expect(view.getByRole('button', { name: 'Search products' })).toBeTruthy();
  expect(view.getByRole('button', { name: 'Sort and filter' })).toBeTruthy();
  expect(view.getByRole('button', { name: /^(Start scan|See my matches)$/ })).toBeTruthy();
  for (const name of ['Shade match', 'Routine', 'Seasonal, new', 'Face', 'Cheeks', 'All']) {
    expect(view.getByRole('button', { name })).toBeTruthy();
  }
  // Section names match where they lead: the category row's "See all" opens Shop.
  expect(view.getByRole('header', { name: 'Shop' })).toBeTruthy();
  expect(view.queryByText('Categories')).toBeNull();
  // Shade twins lives in the Community tab now, not on Home.
  expect(view.queryByRole('button', { name: 'Shade twins' })).toBeNull();
});

test('below the fold: shade picks rail, today\'s routine, running low, disclaimer', async () => {
  const view = await renderHome();
  expect(view.getByText(/^Ranked for /)).toBeTruthy();
  expect(view.getAllByTestId('product-name').length).toBeGreaterThan(0);
  expect(view.getByText("Today's routine")).toBeTruthy();
  expect(view.getByText('Buy Again')).toBeTruthy();
  expect(view.queryByText('Running low')).toBeNull();
  expect(view.queryByText('Picked for your shade')).toBeNull();
  expect(view.getAllByRole('button', { name: /^Reorder / }).length).toBe(2);
  // Replaced by the video's cards.
  expect(view.queryByText('Featured products')).toBeNull();
  // Fit stays qualitative; the promo is labelled demo.
  expect(view.queryAllByText(/\d+% fit/)).toHaveLength(0);
  expect(view.getByText('Demo promo — no purchases in this build.')).toBeTruthy();
});

test('entry points route: search, filter, scan, see-all, bell', async () => {
  const view = await renderHome();
  await fireEvent.press(view.getByRole('button', { name: 'Search products' }));
  await fireEvent.press(view.getByRole('button', { name: 'Sort and filter' }));
  await fireEvent.press(view.getByRole('button', { name: 'Shade match' }));
  await fireEvent.press(view.getByRole('button', { name: 'See all Shop' }));
  await fireEvent.press(view.getByRole('button', { name: 'Shop For You' }));
  await fireEvent.press(view.getByRole('button', { name: 'Notifications' }));
  expect(mockPush.mock.calls.map((c) => c[0])).toEqual([
    '/shop?focus=1',
    '/shop?filter=1',
    '/scan-gate',
    '/shop',
    '/shop',
    '/you',
  ]);
});

test('Seasonal opens the seasonal sheet; Scan again opens the scan flow', async () => {
  const view = await renderHome();
  expect(view.queryByText('Seasonal shade check')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Seasonal, new' }));
  expect(view.getByText('Seasonal shade check')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Scan again' }));
  expect(mockPush).toHaveBeenCalledWith('/scan-gate');
  expect(view.queryByText('Seasonal shade check')).toBeNull();
});
