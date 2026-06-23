import { sampleBaseline } from '../baseline';
import { deriveRegions } from '../regions';
import { solidRgb, fillRect } from '../fixtures';
import { srgbToLab } from '../color';

const SIZE = { width: 100, height: 100 };
const BBOX = { x: 0, y: 0, w: 100, h: 100 };

test('baseline of uniform skin matches that skin colour', () => {
  const img = solidRgb(100, 100, [180, 140, 120]);
  const baseline = sampleBaseline(img, deriveRegions(BBOX, SIZE));
  const expected = srgbToLab(180, 140, 120);
  expect(baseline.L).toBeCloseTo(expected.L, 0);
  expect(baseline.a).toBeCloseTo(expected.a, 0);
});

test('a small dark blot in one cheek does not move the median much (robustness)', () => {
  const regions = deriveRegions(BBOX, SIZE);
  const clean = solidRgb(100, 100, [180, 140, 120]);
  const blotted = fillRect(clean, { x: regions.cheekR.x, y: regions.cheekR.y, w: 3, h: 3 }, [20, 20, 20]);
  const a = sampleBaseline(clean, regions);
  const b = sampleBaseline(blotted, regions);
  expect(Math.abs(a.L - b.L)).toBeLessThan(2);
});
