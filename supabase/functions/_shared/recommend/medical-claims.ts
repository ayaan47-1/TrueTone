// SOURCE OF TRUTH: src/content/medical-claims.ts — this copy is kept in sync manually.
// src/content/medical-claims.ts
// Founder hard rule: the app NEVER gives medical or allergy advice (compliance.md §2).
// Single source of truth for the banned medical-claim phrases. Imported by the chat output guard
// (chat/guard.ts), the allergen copy test and scripts/check-no-medical-claims.mjs. Do not fork it.
// The Edge Function copy (supabase/functions/_shared/recommend/medical-claims.ts) is drift-tested.
//
// Two modes:
//   findMedicalClaims          — strict. Any hit counts. Used on model output (fail closed).
//   findUnnegatedMedicalClaims — CI-guard mode. A sentence that negates or redirects
//                                ("we can't tell you if it's safe for you") is allowed.
//                                Rewrite copy as a negation; never weaken the list.

export const MEDICAL_CLAIM_BLOCKLIST = [
  // Safety / allergy guarantees
  'safe for you', 'safe for your skin', 'safe for me', 'safe for my', 'safe to use with your',
  "won't cause a reaction", 'will not cause a reaction', "won't irritate", 'will not irritate',
  'non-irritating', 'hypoallergenic', 'allergen-free', 'allergen free', 'non-allergenic',
  'reaction-free', 'guaranteed safe', '100% safe', 'completely safe',
  // Diagnosis of the person (we only echo what they told us to flag)
  'you are allergic', "you're allergic", 'you are sensitive to', "you're sensitive to",
  'your allergy', 'cause your allergy', 'you will react', "you'll react", "you won't react",
  // Treatment / structure-function
  'soothes your allergy', 'repairs your barrier', 'desensitiz', 'treats your allerg',
  'cures your allerg',
  // Medical instructions
  'patch test', 'patch-test', 'test if you\'re allergic', 'test if you are allergic',
  // Authority / efficacy without data on file (FTC §5)
  'dermatologist-recommended', 'dermatologist recommended', 'dermatologist-approved',
  'dermatologist approved', 'dermatologist-tested', 'clinically proven', 'clinically tested',
] as const;

// Canonical allergen disclaimer (compliance.md §2.3, design C2). PLACEHOLDER — counsel finalizes
// the wording (D2). Shown on the intake screen, flagged cards, the Account editor and injected into
// chat. Lives here (not allergen-copy.ts) so the Edge Function copy of this module carries it too.
export const ALLERGEN_DISCLAIMER =
  "TrueTone flags ingredients from the product's label against the list you gave us. This is " +
  'information, not medical or allergy advice. Ingredient lists can change — always check the ' +
  'current label, and talk to a doctor or dermatologist about allergies or reactions.';

function normalize(text: string): string {
  return text.toLowerCase().replace(/[‘’ʼ]/g, "'");
}

export function findMedicalClaims(text: string): string[] {
  const lower = normalize(text);
  return MEDICAL_CLAIM_BLOCKLIST.filter((t) => lower.includes(t));
}

// A sentence is allowed if it denies the claim or redirects to a clinician (same shape as
// check-waitlist-copy.mjs's SAFE_CONTEXT).
const NEGATION =
  /\b(not|never|no|cannot|can't|won't|don't|doesn't|isn't|aren't|nor|must not|mustn't|without)\b/;
const REDIRECT = /\b(talk to|consult|see|ask) an? (doctor|dermatologist|clinician)\b/;

// Phrases that are themselves a negated promise ("won't irritate"). A surrounding negation can't
// excuse them, so they fire in every mode.
const ALWAYS_BANNED = MEDICAL_CLAIM_BLOCKLIST.filter((t) => /\b(won't|will not|non-)/.test(t));

export function findUnnegatedMedicalClaims(text: string): string[] {
  const sentences = normalize(text).split(/(?<=[.!?\n])\s+/);
  const hits = new Set<string>();
  for (const s of sentences) {
    const found = MEDICAL_CLAIM_BLOCKLIST.filter((t) => s.includes(t));
    if (found.length === 0) continue;
    // Judge the sentence with the banned phrases cut out, so "won't irritate" can't excuse itself.
    const rest = found.reduce((acc, t) => acc.split(t).join(' '), s);
    const excused = NEGATION.test(rest) || REDIRECT.test(rest);
    found.filter((t) => !excused || ALWAYS_BANNED.includes(t)).forEach((t) => hits.add(t));
  }
  return [...hits];
}
