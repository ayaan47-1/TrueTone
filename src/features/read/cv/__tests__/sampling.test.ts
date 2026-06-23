import { clampRect, lumaAt, meanLab, median, laplacianEnergy, gradientEnergy, localContrastDensity } from '../sampling';
import { solidRgb, addNoise } from '../fixtures';

const FULL = (w: number, h: number) => ({ x: 0, y: 0, w, h });

test('clampRect keeps the rect inside the image', () => {
  expect(clampRect({ x: -5, y: -5, w: 100, h: 100 }, 10, 10)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
});

test('lumaAt of white is ≈1, black is 0', () => {
  expect(lumaAt(solidRgb(1, 1, [255, 255, 255]), 0, 0)).toBeCloseTo(1, 3);
  expect(lumaAt(solidRgb(1, 1, [0, 0, 0]), 0, 0)).toBe(0);
});

test('meanLab of a solid patch matches its colour', () => {
  expect(meanLab(solidRgb(4, 4, [255, 255, 255]), FULL(4, 4)).L).toBeCloseTo(100, 0);
});

test('median handles odd and even lengths', () => {
  expect(median([3, 1, 2])).toBe(2);
  expect(median([1, 2, 3, 4])).toBe(2.5);
});

test('laplacianEnergy is ~0 on a flat patch and rises with noise', () => {
  const flat = solidRgb(16, 16, [180, 140, 120]);
  const noisy = addNoise(flat, FULL(16, 16), 30, 5);
  expect(laplacianEnergy(flat, FULL(16, 16))).toBeCloseTo(0, 5);
  expect(laplacianEnergy(noisy, FULL(16, 16))).toBeGreaterThan(laplacianEnergy(flat, FULL(16, 16)));
});

test('gradientEnergy and localContrastDensity rise with noise', () => {
  const flat = solidRgb(16, 16, [180, 140, 120]);
  const noisy = addNoise(flat, FULL(16, 16), 30, 9);
  expect(gradientEnergy(noisy, FULL(16, 16))).toBeGreaterThan(gradientEnergy(flat, FULL(16, 16)));
  expect(localContrastDensity(noisy, FULL(16, 16), 0.06)).toBeGreaterThan(0);
  expect(localContrastDensity(flat, FULL(16, 16), 0.06)).toBe(0);
});
