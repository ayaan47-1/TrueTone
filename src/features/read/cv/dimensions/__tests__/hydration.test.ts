import { hydration } from '../hydration';
import { deriveRegions } from '../../regions';
import { solidRgb, addNoise } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('smoother skin reads as more hydrated than rough skin', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const smooth = solidRgb(100, 100, [180, 140, 120]);
  const rough = addNoise(smooth, regions.forehead, 35, 17);

  expect(hydration(smooth, regions)).toBeGreaterThan(hydration(rough, regions));
  expect(hydration(rough, regions)).toBeGreaterThanOrEqual(0);
  expect(hydration(smooth, regions)).toBeLessThanOrEqual(1);
});
