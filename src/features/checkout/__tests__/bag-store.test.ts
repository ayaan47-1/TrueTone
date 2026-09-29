// The bag keeps one line per product + chosen shade, and quantities change immutably.
import { bag, bagCount, bagSubtotal, lineKey } from '../bag-store';
import { catalog } from '../../match/product-catalog';

const [a, b] = catalog;

beforeEach(() => bag.clear());

test('adding the same product in two shades keeps two lines', () => {
  bag.add(a, 1, 'Sand 3W');
  bag.add(a, 1, 'Honey 5W');
  expect(bag.getState().lines).toHaveLength(2);
});

test('adding the same product + shade bumps its quantity', () => {
  bag.add(a, 1, 'Sand 3W');
  bag.add(a, 2, 'Sand 3W');
  expect(bag.getState().lines).toEqual([{ product: a, qty: 3, shade: 'Sand 3W' }]);
});

test('setQty changes one line and 0 removes it', () => {
  bag.add(a, 1, 'Sand 3W');
  bag.add(b);
  const key = lineKey(bag.getState().lines[0]);
  bag.setQty(key, 4);
  expect(bagCount(bag.getState())).toBe(5);
  expect(bagSubtotal(bag.getState())).toBe(a.price * 4 + b.price);
  bag.setQty(key, 0);
  expect(bag.getState().lines.map((l) => l.product.id)).toEqual([b.id]);
});

test('state is replaced, never mutated', () => {
  bag.add(a);
  const before = bag.getState();
  bag.add(a);
  expect(before.lines[0].qty).toBe(1);
});
