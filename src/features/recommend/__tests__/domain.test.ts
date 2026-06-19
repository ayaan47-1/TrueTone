import type { RecommendationDomain, Routine } from '../domain';
import type { RecommendationAttrs } from '../routine-types';

// A trivial in-test domain proves the seam's shape compiles and is usable.
const fake: RecommendationDomain = {
  id: 'test',
  version: 'test-1',
  buildRoutine: (_attrs: RecommendationAttrs): Routine => ({
    version: 'test-1', am: [], pm: [], notes: [],
  }),
};

test('a domain exposes id, version, and buildRoutine returning a Routine', () => {
  const r = fake.buildRoutine({
    scores: {
      hydration: 0.5, oiliness: 0.5, texture: 0.5, pores: 0.5,
      darkSpots: 0.5, redness: 0.5, fineLines: 0.5, darkCircles: 0.5,
    },
    skinType: 'combination',
  });
  expect(fake.id).toBe('test');
  expect(r.version).toBe('test-1');
  expect(Array.isArray(r.am)).toBe(true);
  expect(Array.isArray(r.pm)).toBe(true);
});
