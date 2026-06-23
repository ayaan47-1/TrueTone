import { redness } from '../redness';
import { deriveRegions } from '../../regions';
import { sampleBaseline } from '../../baseline';
import { solidRgb, fillRect } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('redness rises when the T-zone is reddened, vs a neutral face', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const neutral = solidRgb(100, 100, [180, 140, 120]);
  const baseline = sampleBaseline(neutral, regions); // cheeks neutral
  const reddened = fillRect(neutral, regions.tZone, [210, 110, 100]);

  const rNeutral = redness(neutral, regions, baseline);
  const rRed = redness(reddened, regions, baseline);

  expect(rRed).toBeGreaterThan(rNeutral);
  expect(rNeutral).toBeGreaterThanOrEqual(0);
  expect(rRed).toBeLessThanOrEqual(1);
});
