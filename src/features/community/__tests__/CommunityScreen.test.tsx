import { render, fireEvent } from '@testing-library/react-native';
import { CommunityScreen } from '../CommunityScreen';
import { SEED_POSTS, SEED_ROUTINES } from '../community-seed';
import { catalog } from '../../match/product-catalog';

const firstPost = SEED_POSTS[0];
const firstPostProduct = catalog.find((p) => p.id === firstPost.taggedProductIds[0])!;
const firstRoutine = SEED_ROUTINES[0];

test('defaults to the Feed tab, showing seeded posts with creator handles', async () => {
  const view = await render(<CommunityScreen />);
  expect(view.getByText(`@${firstPost.creator.username}`)).toBeTruthy();
  expect(view.getByText(firstPost.caption)).toBeTruthy();
  expect(view.queryByText(firstRoutine.title)).toBeNull();
});

test('switching to Routines shows seeded routines instead of posts', async () => {
  const view = await render(<CommunityScreen />);
  await fireEvent.press(view.getByTestId('community-tab-routines'));

  expect(view.getByText(firstRoutine.title)).toBeTruthy();
  expect(view.getByText(firstRoutine.summary)).toBeTruthy();
  expect(view.queryByText(firstPost.caption)).toBeNull();
});

test('liking a post toggles its state and count', async () => {
  const view = await render(<CommunityScreen />);
  const likeButtons = view.getAllByTestId('engagement-like');

  expect(view.getByText(String(firstPost.likeCount))).toBeTruthy();
  await fireEvent.press(likeButtons[0]);
  expect(view.getByText(String(firstPost.likeCount + 1))).toBeTruthy();

  await fireEvent.press(likeButtons[0]);
  expect(view.getByText(String(firstPost.likeCount))).toBeTruthy();
});

test('saving a post toggles its state and count', async () => {
  const view = await render(<CommunityScreen />);
  const saveButtons = view.getAllByTestId('engagement-save');

  expect(view.getByText(String(firstPost.saveCount))).toBeTruthy();
  await fireEvent.press(saveButtons[0]);
  expect(view.getByText(String(firstPost.saveCount + 1))).toBeTruthy();
});

test('sharing a post increments a visible share count from zero', async () => {
  const view = await render(<CommunityScreen />);
  const shareButtons = view.getAllByTestId('engagement-share');

  await fireEvent.press(shareButtons[0]);
  expect(view.getByText('1')).toBeTruthy();
});

test('Shop the look opens a drawer listing the tagged catalog product, and it closes', async () => {
  const view = await render(<CommunityScreen />);
  const shopButtons = view.getAllByTestId('shop-the-look');

  await fireEvent.press(shopButtons[0]);
  expect(view.getByTestId(`tagged-product-${firstPostProduct.id}`)).toBeTruthy();
  expect(view.getByText(firstPostProduct.name)).toBeTruthy();

  await fireEvent.press(view.getByLabelText('Close'));
  expect(view.queryByTestId(`tagged-product-${firstPostProduct.id}`)).toBeNull();
});

test('a post with more than one media item shows carousel dots', async () => {
  const view = await render(<CommunityScreen />);
  expect(view.getAllByTestId(/^media-dot-/).length).toBeGreaterThan(0);
});
