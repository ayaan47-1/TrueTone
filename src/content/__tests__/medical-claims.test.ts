import {
  MEDICAL_CLAIM_BLOCKLIST,
  findMedicalClaims,
  findUnnegatedMedicalClaims,
} from '../medical-claims';

describe('MEDICAL_CLAIM_BLOCKLIST (compliance.md §2.1)', () => {
  test.each([
    'safe for you', 'safe for your skin', "won't cause a reaction", "won't irritate",
    'non-irritating', 'hypoallergenic', 'allergen-free', 'reaction-free', 'guaranteed safe',
    '100% safe', 'you are allergic to', "you're sensitive to", 'your allergy', 'you will react',
    'soothes your allergy', 'repairs your barrier', 'desensitizes', 'patch test',
    'dermatologist-recommended', 'clinically proven safe',
  ])('catches the banned phrase "%s"', (phrase) => {
    expect(findMedicalClaims(`Good news: ${phrase} here.`).length).toBeGreaterThan(0);
  });

  test('entries are lowercase and unique', () => {
    for (const t of MEDICAL_CLAIM_BLOCKLIST) expect(t).toBe(t.toLowerCase());
    expect(new Set(MEDICAL_CLAIM_BLOCKLIST).size).toBe(MEDICAL_CLAIM_BLOCKLIST.length);
  });

  test('is case-insensitive and treats a curly apostrophe like a straight one', () => {
    expect(findMedicalClaims('This is HYPOALLERGENIC')).toContain('hypoallergenic');
    expect(findMedicalClaims('It won’t irritate')).toContain("won't irritate");
  });

  test('allowed label-sourced phrasing passes (compliance.md §2.2)', () => {
    const allowed = [
      'You asked us to flag fragrance/parfum. This product\'s ingredient list includes it.',
      'Contains linalool, one of the ingredients you\'re avoiding.',
      'These two are commonly not layered together.',
      "We don't have a full ingredient list for this product, so we couldn't check it against your list. Check the label.",
    ];
    for (const s of allowed) expect(findMedicalClaims(s)).toEqual([]);
  });
});

describe('findUnnegatedMedicalClaims (CI-guard mode: a negated or redirected sentence is allowed)', () => {
  test('a banned phrase inside a negation is allowed', () => {
    expect(findUnnegatedMedicalClaims("We can't tell you if a product is safe for you.")).toEqual([]);
    expect(findUnnegatedMedicalClaims('You MUST NOT say anything is hypoallergenic.')).toEqual([]);
  });

  test('a banned phrase in a plain claim still fires', () => {
    expect(findUnnegatedMedicalClaims('Great pick. This one is safe for you.')).toContain('safe for you');
  });

  test('a banned phrase that is itself a negated promise always fires', () => {
    expect(findUnnegatedMedicalClaims("Don't worry, it won't irritate.")).toContain("won't irritate");
    expect(findUnnegatedMedicalClaims("This one won't irritate.")).toContain("won't irritate");
    expect(findUnnegatedMedicalClaims('Promise: you won’t react.')).toContain("you won't react");
  });

  test('negation in one sentence does not cover a claim in the next', () => {
    expect(findUnnegatedMedicalClaims("This isn't advice. It is hypoallergenic.")).toContain('hypoallergenic');
  });
});
