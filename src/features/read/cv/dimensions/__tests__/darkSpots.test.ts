import { darkSpots } from '../darkSpots';
import { deriveRegions } from '../../regions';
import { sampleBaseline } from '../../baseline';
import { solidRgb, fillRect } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('darkSpots rises with localized hyperpigmentation on the forehead', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const clear = solidRgb(100, 100, [180, 140, 120]);
  const baseline = sampleBaseline(clear, regions); // cheeks unaffected
  const spot = fillRect(clear, { x: regions.forehead.x + 2, y: regions.forehead.y + 2, w: 6, h: 6 }, [120, 92, 80]);

  expect(darkSpots(spot, regions, baseline)).toBeGreaterThan(darkSpots(clear, regions, baseline));
  expect(darkSpots(clear, regions, baseline)).toBe(0);
});
