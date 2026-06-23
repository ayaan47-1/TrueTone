import { classify } from '../skin-type';
import type { ScoreVector } from '../../read-types';

const base: ScoreVector = {
  hydration: 0.5, oiliness: 0.5, texture: 0.5, pores: 0.5,
  darkSpots: 0.5, redness: 0.5, fineLines: 0.5, darkCircles: 0.5,
};

test('high redness reads as sensitive', () => {
  expect(classify({ ...base, redness: 0.7 })).toBe('sensitive');
});
test('high oiliness (low redness) reads as oily', () => {
  expect(classify({ ...base, oiliness: 0.7, redness: 0.3 })).toBe('oily');
});
test('low hydration (low oiliness/redness) reads as dry', () => {
  expect(classify({ ...base, hydration: 0.2, oiliness: 0.3, redness: 0.3 })).toBe('dry');
});
test('mid values default to combination', () => {
  expect(classify(base)).toBe('combination');
});
