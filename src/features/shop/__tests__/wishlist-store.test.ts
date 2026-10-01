// In-memory saved-items (wishlist) store behind the v3 heart buttons.
import { renderHook, act } from '@testing-library/react-native';
import { useWishlist, wishlist } from '../wishlist-store';

beforeEach(() => wishlist.clear());

test('toggle adds then removes an id, immutably', () => {
  const before = wishlist.getState();
  wishlist.toggle('a');
  expect(wishlist.getState()).toEqual(['a']);
  expect(before).toEqual([]);
  wishlist.toggle('a');
  expect(wishlist.getState()).toEqual([]);
});

test('useWishlist re-renders on change', async () => {
  const { result } = await renderHook(() => useWishlist());
  expect(result.current).toEqual([]);
  await act(async () => wishlist.toggle('b'));
  expect(result.current).toEqual(['b']);
});
