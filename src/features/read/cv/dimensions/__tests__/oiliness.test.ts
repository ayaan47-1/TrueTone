import { oiliness } from '../oiliness';
import { deriveRegions } from '../../regions';
import { solidRgb, fillRect } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('oiliness rises with specular highlights in the T-zone', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const matte = solidRgb(100, 100, [180, 140, 120]);
  const shiny = fillRect(matte, regions.tZone, [250, 250, 250]);

  expect(oiliness(shiny, regions)).toBeGreaterThan(oiliness(matte, regions));
  expect(oiliness(matte, regions)).toBeGreaterThanOrEqual(0);
  expect(oiliness(shiny, regions)).toBeLessThanOrEqual(1);
});
