// eval/fairness/__tests__/fst.test.ts
import { FITZPATRICK, fstIndex, isFitzpatrick } from '../fst';

test('there are six Fitzpatrick types in order', () => {
  expect([...FITZPATRICK]).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI']);
});
test('fstIndex is 1-based', () => {
  expect(fstIndex('I')).toBe(1);
  expect(fstIndex('VI')).toBe(6);
});
test('isFitzpatrick narrows valid values only', () => {
  expect(isFitzpatrick('IV')).toBe(true);
  expect(isFitzpatrick('VII')).toBe(false);
  expect(isFitzpatrick(4)).toBe(false);
});
