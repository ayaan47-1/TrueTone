import { darkCircles } from '../darkCircles';
import { deriveRegions } from '../../regions';
import { sampleBaseline } from '../../baseline';
import { solidRgb, fillRect } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('darkCircles rises when the under-eye regions are darkened', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const neutral = solidRgb(100, 100, [180, 140, 120]);
  const baseline = sampleBaseline(neutral, regions);
  let dark = fillRect(neutral, regions.infraorbitalL, [120, 95, 82]);
  dark = fillRect(dark, regions.infraorbitalR, [120, 95, 82]);

  expect(darkCircles(dark, regions, baseline)).toBeGreaterThan(darkCircles(neutral, regions, baseline));
  expect(darkCircles(neutral, regions, baseline)).toBeGreaterThanOrEqual(0);
});
