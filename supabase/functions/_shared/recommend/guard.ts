// SOURCE OF TRUTH: src/features/recommend/chat/guard.ts — this copy is kept in sync manually.
// Output-side fail-closed catch (CLAUDE.md §1): if the LLM emits any blocklisted disease/diagnostic
// term or medical claim (compliance.md §3.2.3), discard its text entirely and return a safe
// fallback. The raw model text is NEVER shown.
import { findDiseaseTerms } from './cosmetic-filter.ts';
import { ALLERGEN_DISCLAIMER, findMedicalClaims } from './medical-claims.ts';

export const FALLBACK_MESSAGE =
  "I can only speak to how your skin looks and your cosmetic routine. For anything medical — like a " +
  'specific spot or change in your skin — please see a board-certified dermatologist.';

// Allergy topics get the disclaimer injected by code (compliance.md §2.3 placement 4).
const ALLERGY_TOPIC = /allerg|reaction/i;

export function guardReply(text: string): { safe: string; blocked: boolean } {
  if (findDiseaseTerms(text).length > 0 || findMedicalClaims(text).length > 0) {
    return { safe: FALLBACK_MESSAGE, blocked: true };
  }
  if (ALLERGY_TOPIC.test(text)) {
    return { safe: `${text}\n\n${ALLERGEN_DISCLAIMER}`, blocked: false };
  }
  return { safe: text, blocked: false };
}
