// src/features/match/__tests__/fit-tier.test.ts
// The UI never shows the numeric fit score (compliance ruling: a bare "99% fit" reads as an
// accuracy claim). fitTier maps the 40..99 ranking score to a qualitative label.
import { fitTier } from '../fit-tier';
import { FIT_TIER_LABELS, MAKEUP_APPROVED_LABELS } from '../../../content/makeup-vocab';

describe('fitTier', () => {
  test.each([
    [99, 'great'],
    [90, 'great'],
    [89, 'good'],
    [75, 'good'],
    [74, 'try'],
    [40, 'try'],
  ] as const)('score %i -> %s', (score, tier) => {
    expect(fitTier(score)).toBe(tier);
  });

  test('labels are qualitative words, never a number or percent', () => {
    expect(FIT_TIER_LABELS).toEqual({
      great: 'Great match',
      good: 'Good match',
      try: 'Worth a try',
    });
    for (const label of Object.values(FIT_TIER_LABELS)) expect(label).not.toMatch(/\d|%/);
  });

  test('tier labels are in the compliance-checked approved list', () => {
    for (const label of Object.values(FIT_TIER_LABELS)) {
      expect(MAKEUP_APPROVED_LABELS).toContain(label);
    }
  });
});
