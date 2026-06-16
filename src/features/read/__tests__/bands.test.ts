// src/features/read/__tests__/bands.test.ts
import { toBand, direction } from '../bands';

test('value maps to the correct band at thirds boundaries', () => {
  expect(toBand('hydration', 0.0).label).toBe('Looks dehydrated');
  expect(toBand('hydration', 0.33).index).toBe(0);
  expect(toBand('hydration', 0.34).index).toBe(1);
  expect(toBand('hydration', 0.5).label).toBe('Balanced');
  expect(toBand('hydration', 0.67).index).toBe(2);
  expect(toBand('hydration', 1.0).label).toBe('Looks well-hydrated');
});
test('value is clamped to 0..1', () => {
  expect(toBand('pores', -5).index).toBe(0);
  expect(toBand('pores', 5).index).toBe(2);
});
test('direction needs a previous value and a threshold', () => {
  expect(direction(0.6, null)).toBe('same');
  expect(direction(0.6, 0.5)).toBe('up');
  expect(direction(0.5, 0.6)).toBe('down');
  expect(direction(0.51, 0.5)).toBe('same'); // within eps
});
