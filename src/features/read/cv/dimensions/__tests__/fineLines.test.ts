import { fineLines } from '../fineLines';
import { deriveRegions } from '../../regions';
import { solidRgb, vStripes } from '../../fixtures';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('fineLines rises with line-like structure around the eyes', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const smooth = solidRgb(100, 100, [180, 140, 120]);
  let lined = vStripes(smooth, regions.periocularL, 60);
  lined = vStripes(lined, regions.periocularR, 60);

  expect(fineLines(lined, regions)).toBeGreaterThan(fineLines(smooth, regions));
  expect(fineLines(smooth, regions)).toBeGreaterThanOrEqual(0);
  expect(fineLines(lined, regions)).toBeLessThanOrEqual(1);
});
