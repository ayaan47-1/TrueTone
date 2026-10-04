import { createOrderHistory } from '../order-history-store';

test('records purchased product ids, most recent first, de-duplicated', () => {
  const h = createOrderHistory();
  expect(h.purchasedIds()).toEqual([]);
  h.record(['a', 'b']);
  h.record(['c', 'a']);
  expect(h.purchasedIds()).toEqual(['c', 'a', 'b']);
});

test('returned ids are a copy and clear() empties the history', () => {
  const h = createOrderHistory();
  h.record(['a']);
  const ids = h.purchasedIds() as string[];
  ids.push('mutated');
  expect(h.purchasedIds()).toEqual(['a']);
  h.clear();
  expect(h.purchasedIds()).toEqual([]);
});
