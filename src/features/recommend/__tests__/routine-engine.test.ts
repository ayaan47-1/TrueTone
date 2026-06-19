import { buildRoutine } from '../routine-engine';
import { skincareDomain } from '../skincare/domain';
import { SKINCARE_LIBRARY } from '../skincare/library';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';
import type { ScoreVector } from '../../read/read-types';

const flat = (v: number): ScoreVector => ({
  hydration: v, oiliness: v, texture: v, pores: v,
  darkSpots: v, redness: v, fineLines: v, darkCircles: v,
});
const libraryCategories = new Set(Object.values(SKINCARE_LIBRARY).map((e) => e.category));

test('stamps the domain version', () => {
  const r = buildRoutine(skincareDomain, { scores: flat(0.5), skinType: 'combination' });
  expect(r.version).toBe('skincare-1');
});

test('every emitted step category comes from the approved library (structural invariant)', () => {
  const r = buildRoutine(skincareDomain, { scores: flat(0.8), skinType: 'sensitive' });
  const libraryEntries = Object.values(SKINCARE_LIBRARY);
  for (const step of [...r.am, ...r.pm]) {
    const match = libraryEntries.some(
      (e) => e.category === step.category && e.habit === step.habit && e.rationale === step.rationale,
    );
    expect(match).toBe(true);
  }
});

test('no emitted string contains a disease term', () => {
  const r = buildRoutine(skincareDomain, { scores: flat(0.8), skinType: 'oily' });
  const strings = [...r.am, ...r.pm].flatMap((s) => [s.category, s.habit, s.rationale]).concat(r.notes);
  for (const s of strings) expect(findDiseaseTerms(s)).toEqual([]);
});

test('SPF appears in AM and never in PM', () => {
  const r = buildRoutine(skincareDomain, { scores: flat(0.5), skinType: 'dry' });
  expect(r.am.some((s) => s.category.includes('SPF'))).toBe(true);
  expect(r.pm.some((s) => s.category.includes('SPF'))).toBe(false);
});

test('a PM-only step (exfoliant) never appears in AM', () => {
  const r = buildRoutine(skincareDomain, { scores: { ...flat(0.3), texture: 0.9 }, skinType: 'combination' });
  expect(r.pm.some((s) => s.category.includes('exfoliant'))).toBe(true);
  expect(r.am.some((s) => s.category.includes('exfoliant'))).toBe(false);
});

test('includes the skin-type note', () => {
  const r = buildRoutine(skincareDomain, { scores: flat(0.5), skinType: 'dry' });
  expect(r.notes.length).toBeGreaterThan(0);
});
