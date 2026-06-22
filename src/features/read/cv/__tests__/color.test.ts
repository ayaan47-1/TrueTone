import { srgbToLab } from '../color';

test('white maps to L≈100, a≈0, b≈0', () => {
  const { L, a, b } = srgbToLab(255, 255, 255);
  expect(L).toBeCloseTo(100, 0);
  expect(a).toBeCloseTo(0, 0);
  expect(b).toBeCloseTo(0, 0);
});

test('black maps to L≈0', () => {
  expect(srgbToLab(0, 0, 0).L).toBeCloseTo(0, 1);
});

test('pure red has strongly positive a*', () => {
  expect(srgbToLab(255, 0, 0).a).toBeGreaterThan(50);
});
