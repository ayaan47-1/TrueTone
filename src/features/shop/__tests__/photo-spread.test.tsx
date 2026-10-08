// Kit photos spread across a displayed list: two products side by side in one grid row
// (or next to each other in a rail) never show the same image. Deterministic per list order.
import { render, within } from '@testing-library/react-native';
import { catalog } from '../../match/product-catalog';
import type { MatchProfile } from '../../match/match-types';
import { KIT_PHOTOS, photoKey, spreadPhotoKeys } from '../product-photos';
import { ShopGrid } from '../ShopGrid';

const face = catalog.filter((p) => p.category === 'face');
const noAdjacentPhotoRepeat = (keys: readonly (string | undefined)[]) =>
  keys.slice(1).forEach((key, index) => {
    if (key !== undefined && keys[index] !== undefined) expect(key).not.toBe(keys[index]);
  });

test('neighbours in a list never share a kit photo (all-face list, catalog order and reversed)', () => {
  noAdjacentPhotoRepeat(spreadPhotoKeys(face));
  noAdjacentPhotoRepeat(spreadPhotoKeys([...face].reverse()));
  noAdjacentPhotoRepeat(spreadPhotoKeys(catalog));
});

test('the assignment is deterministic and keeps the kind-matched photo when there is no clash', () => {
  expect(spreadPhotoKeys(catalog)).toEqual(spreadPhotoKeys(catalog));
  const keys = spreadPhotoKeys(catalog);
  expect(keys[0]).toBe(photoKey(catalog[0]));
  expect(spreadPhotoKeys([])).toEqual([]);
});

test.each<[string, MatchProfile | undefined]>([
  ['pre-scan', undefined],
  ['post-scan', { shade: 6, undertone: 'warm', coverage: 'everyday', skips: [] }],
])('%s shop grid: photos are eligible and tint/concealer tiles use drawn art', async (_label, profile) => {
  const view = await render(<ShopGrid profile={profile} onOpen={jest.fn()} onScan={jest.fn()} onBag={jest.fn()} />);
  const sources = view.getAllByTestId('product-photo').map((n) => n.props.source);
  expect(sources.length).toBeGreaterThan(2);
  sources.forEach((source) => expect(Object.values(KIT_PHOTOS)).toContain(source));

  catalog.filter((product) => /concealer|tint/i.test(product.name)).forEach((product) => {
    const tile = view.queryByTestId(`product-${product.id}`);
    if (!tile) return;
    const shape = /concealer/i.test(product.name) ? 'tube' : 'pump';
    expect(within(tile).queryByTestId('product-photo')).toBeNull();
    expect(within(tile).getByTestId(`product-art-${shape}`)).toBeTruthy();
  });
});
