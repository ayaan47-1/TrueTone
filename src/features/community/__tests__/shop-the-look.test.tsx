import { render, fireEvent } from '@testing-library/react-native';
import { CommunityScreen } from '../CommunityScreen';
import { SEED_POSTS, SEED_ROUTINES } from '../community-seed';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => mockPush.mockClear());

const routine = SEED_ROUTINES.find((r) => r.taggedProductIds.length > 0)!;
const routineProductId = routine.taggedProductIds[0];

test('Routines > Shop the look: tapping a product opens its product page and closes the drawer', async () => {
  const view = await render(<CommunityScreen />);
  await fireEvent.press(view.getByTestId('community-tab-routines'));
  const routineIndex = SEED_ROUTINES.filter((r) => r.taggedProductIds.length > 0).indexOf(routine);
  await fireEvent.press(view.getAllByTestId('shop-the-look')[routineIndex]);

  const row = view.getByTestId(`tagged-product-${routineProductId}`);
  expect(row.props.accessibilityRole).toBe('button');
  await fireEvent.press(row);

  expect(mockPush).toHaveBeenCalledWith(`/product/${routineProductId}`);
  expect(view.queryByTestId(`tagged-product-${routineProductId}`)).toBeNull();
});

test('Feed > Shop the look products are tappable too', async () => {
  const post = SEED_POSTS.find((p) => p.taggedProductIds.length > 0)!;
  const view = await render(<CommunityScreen />);
  await fireEvent.press(view.getAllByTestId('shop-the-look')[0]);
  await fireEvent.press(view.getByTestId(`tagged-product-${post.taggedProductIds[0]}`));
  expect(mockPush).toHaveBeenCalledWith(`/product/${post.taggedProductIds[0]}`);
});

test('post action row wraps instead of clipping the like/save buttons on narrow phones', async () => {
  const view = await render(<CommunityScreen />);
  const row = view.getAllByTestId('post-actions')[0];
  expect(String(row.props.className)).toMatch(/\bflex-wrap\b/);
  const bar = view.getAllByTestId('engagement-bar')[0];
  expect(String(bar.props.className)).toMatch(/\bshrink-0\b/);
});

test('like and save buttons keep a 44pt minimum tap target', async () => {
  const view = await render(<CommunityScreen />);
  for (const id of ['engagement-like', 'engagement-save']) {
    const btn = view.getAllByTestId(id)[0];
    expect(String(btn.props.className)).toMatch(/min-w-\[44px\]/);
    expect(String(btn.props.className)).toMatch(/min-h-\[44px\]/);
  }
});
