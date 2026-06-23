import { texture } from '../texture';
import { deriveRegions } from '../../regions';
import { solidRgb, addNoise } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('texture rises when forehead skin is rougher (high-frequency noise)', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const smooth = solidRgb(100, 100, [180, 140, 120]);
  const rough = addNoise(smooth, regions.forehead, 35, 3);

  expect(texture(rough, regions)).toBeGreaterThan(texture(smooth, regions));
  expect(texture(smooth, regions)).toBeGreaterThanOrEqual(0);
  expect(texture(rough, regions)).toBeLessThanOrEqual(1);
});
