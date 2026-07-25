import type { RgbImage, Rect, Regions, SkinBaseline, Lab } from '../types';
import { REGION_NAMES } from '../types';

test('REGION_NAMES lists all eight face regions', () => {
  expect([...REGION_NAMES].sort()).toEqual(
    ['cheekL', 'cheekR', 'forehead', 'infraorbitalL', 'infraorbitalR', 'periocularL', 'periocularR', 'tZone'].sort(),
  );
});

test('types are structurally usable', () => {
  const r: Rect = { x: 0, y: 0, w: 1, h: 1 };
  const img: RgbImage = { width: 1, height: 1, data: new Uint8ClampedArray(4) };
  const b: SkinBaseline = { L: 50, a: 5, b: 10, Y: 0.2, logRG: 0.1 };
  const lab: Lab = { L: 50, a: 5, b: 10 };
  const _regionKey: keyof Regions = 'cheekL';
  expect(img.data).toHaveLength(4);
  expect([r.w, b.L, lab.L, _regionKey]).toBeTruthy();
});
