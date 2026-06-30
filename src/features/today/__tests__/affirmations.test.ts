import { AFFIRMATIONS, pickAffirmation } from '../affirmations';

describe('pickAffirmation', () => {
  it('returns one of the affirmations', () => {
    expect(AFFIRMATIONS).toContain(pickAffirmation(new Date(2026, 5, 24)));
  });

  it('is stable for the same day', () => {
    const a = pickAffirmation(new Date(2026, 5, 24, 9));
    const b = pickAffirmation(new Date(2026, 5, 24, 22));
    expect(a).toBe(b);
  });

  it('changes across days (rotates through the list)', () => {
    const picks = new Set(
      Array.from({ length: AFFIRMATIONS.length }, (_, i) =>
        pickAffirmation(new Date(2026, 0, 1 + i)),
      ),
    );
    expect(picks.size).toBeGreaterThan(1);
  });

  it('never contains disease/diagnosis language', () => {
    const banned = /acne|rosacea|eczema|melasma|dermatitis|psoriasis|cancer|melanoma|cure|treat|disease/i;
    AFFIRMATIONS.forEach((a) => expect(a).not.toMatch(banned));
  });
});
