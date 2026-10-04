import { suggestProducts } from '../routine-suggestions';
import { catalog } from '../../match/product-catalog';

const [p0, p1, p2, p3] = catalog;

test('purchased items come first, then saved, then the rest of the catalog', () => {
  const out = suggestProducts({ purchasedIds: [p2.id], savedIds: [p1.id], exclude: [] });
  expect(out[0]).toEqual({ product: p2, source: 'purchased' });
  expect(out[1]).toEqual({ product: p1, source: 'saved' });
  expect(out.slice(2).every((s) => s.source === 'catalog')).toBe(true);
  expect(out).toHaveLength(catalog.length);
});

test('an item both bought and saved is listed once, as purchased', () => {
  const out = suggestProducts({ purchasedIds: [p1.id], savedIds: [p1.id], exclude: [] });
  expect(out.filter((s) => s.product.id === p1.id)).toEqual([{ product: p1, source: 'purchased' }]);
});

test('excludes products already in the slot and ignores unknown ids', () => {
  const out = suggestProducts({ purchasedIds: ['nope', p0.id], savedIds: [p3.id], exclude: [p0.id, p3.id] });
  const ids = out.map((s) => s.product.id);
  expect(ids).not.toContain(p0.id);
  expect(ids).not.toContain(p3.id);
  expect(ids).not.toContain('nope');
  expect(out.some((s) => s.source !== 'catalog')).toBe(false);
});
