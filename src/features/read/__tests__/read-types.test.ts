// src/features/read/__tests__/read-types.test.ts
import { DIMENSIONS } from '../../../content/cosmetic-vocab';
import type { ReadResult, ScoreVector } from '../read-types';

test('a ReadResult has a score for every dimension', () => {
  const scores = Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ScoreVector;
  const r: ReadResult = { scores, skinType: 'combination', modelVersion: 'stub-1', isStub: true };
  expect(Object.keys(r.scores)).toHaveLength(DIMENSIONS.length);
  expect(r.isStub).toBe(true);
});
