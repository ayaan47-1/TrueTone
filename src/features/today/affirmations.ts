// Daily affirmations for the Today dashboard. Pure cosmetic / general-wellness
// encouragement — no disease, diagnosis, or treatment language (CLAUDE.md §1).

export const AFFIRMATIONS = [
  'I allow my skin to change at its own pace.',
  'Caring for my skin is a small act of kindness to myself.',
  'My worth was never about my appearance.',
  'Showing up for my routine today is enough.',
  'I meet my reflection with patience, not judgment.',
  'Healthy habits are a gift I keep giving myself.',
  'I can be honest about my skin and gentle with myself.',
  'Consistency, not perfection, is what I am after.',
  'I notice what my skin needs and respond with care.',
  'Today I choose calm over comparison.',
] as const;

export type Affirmation = (typeof AFFIRMATIONS)[number];

/** Day-of-year index into the affirmations, so it rotates daily and is stable per day. */
export function pickAffirmation(today: Date): Affirmation {
  const start = new Date(today.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return AFFIRMATIONS[dayOfYear % AFFIRMATIONS.length];
}
