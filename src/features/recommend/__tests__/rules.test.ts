import { selectCategories } from '../skincare/rules';
import type { ScoreVector } from '../../read/read-types';

const flat = (v: number): ScoreVector => ({
  hydration: v, oiliness: v, texture: v, pores: v,
  darkSpots: v, redness: v, fineLines: v, darkCircles: v,
});

test('always includes the universal base steps', () => {
  const keys = selectCategories({ scores: flat(0.5), skinType: 'combination' });
  expect(keys).toContain('gentle_cleanser');
  expect(keys).toContain('daily_spf');
});

test('oily skin type selects oil control, not a hydrating serum', () => {
  const keys = selectCategories({ scores: flat(0.5), skinType: 'oily' });
  expect(keys).toContain('oil_control');
  expect(keys).not.toContain('hydrating_serum');
});

test('low hydration on non-oily skin selects a hydrating serum', () => {
  const keys = selectCategories({ scores: { ...flat(0.5), hydration: 0.2 }, skinType: 'dry' });
  expect(keys).toContain('hydrating_serum');
});

test('elevated dark spots select a brightening serum', () => {
  const keys = selectCategories({ scores: { ...flat(0.3), darkSpots: 0.8 }, skinType: 'combination' });
  expect(keys).toContain('brightening_serum');
});

test('output is deterministic and order-stable', () => {
  const a = selectCategories({ scores: flat(0.7), skinType: 'sensitive' });
  const b = selectCategories({ scores: flat(0.7), skinType: 'sensitive' });
  expect(a).toEqual(b);
});

// Boundary checks: thresholds are inclusive (oiliness >= 0.6, hydration <= 0.4).
test('oiliness exactly at the elevated threshold selects oil control', () => {
  const keys = selectCategories({ scores: { ...flat(0.5), oiliness: 0.6 }, skinType: 'combination' });
  expect(keys).toContain('oil_control');
});

test('oiliness just below the threshold does not select oil control', () => {
  const keys = selectCategories({ scores: { ...flat(0.5), oiliness: 0.59 }, skinType: 'combination' });
  expect(keys).not.toContain('oil_control');
});

test('hydration exactly at the low threshold selects a hydrating serum on non-oily skin', () => {
  const keys = selectCategories({ scores: { ...flat(0.5), hydration: 0.4 }, skinType: 'dry' });
  expect(keys).toContain('hydrating_serum');
});
