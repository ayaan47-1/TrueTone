// Kit photos spread across a displayed list: two products side by side in one grid row
// (or next to each other in a rail) never show the same image. Deterministic per list order.
import { render } from '@testing-library/react-native';
import { catalog } from '../../match/product-catalog';
import type { MatchProfile } from '../../match/match-types';
import { photoKey, spreadPhotoKeys } from '../product-photos';
import { ShopGrid } from '../ShopGrid';

const face = catalog.filter((p) => p.category === 'face');
const noAdjacentRepeat = (keys: readonly string[]) =>
  keys.slice(1).forEach((k, i) => expect(k).not.toBe(keys[i]));

test('neighbours in a list never share a kit photo (all-face list, catalog order and reversed)', () => {
  noAdjacentRepeat(spreadPhotoKeys(face));
  noAdjacentRepeat(spreadPhotoKeys([...face].reverse()));
  noAdjacentRepeat(spreadPhotoKeys(catalog));
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
])('%s shop grid: the two tiles in each row show different photos', async (_label, profile) => {
  const view = await render(<ShopGrid profile={profile} onOpen={jest.fn()} onScan={jest.fn()} onBag={jest.fn()} />);
  const sources = view.getAllByTestId('product-photo').map((n) => n.props.source);
  expect(sources.length).toBeGreaterThan(2);
  for (let i = 0; i + 1 < sources.length; i += 2) expect(sources[i + 1]).not.toBe(sources[i]);
});
