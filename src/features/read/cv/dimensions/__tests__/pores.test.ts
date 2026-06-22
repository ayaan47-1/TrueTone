import { pores } from '../pores';
import { deriveRegions } from '../../regions';
import { solidRgb, addNoise } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('pores rises with fine speckle in the T-zone', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const clear = solidRgb(100, 100, [180, 140, 120]);
  const speckled = addNoise(clear, regions.tZone, 40, 11);

  expect(pores(speckled, regions)).toBeGreaterThan(pores(clear, regions));
  expect(pores(clear, regions)).toBe(0);
});
