// Output-side fail-closed catch (CLAUDE.md §1): if the LLM emits any blocklisted disease/diagnostic
// term, discard its text entirely and return a safe fallback. The raw model text is NEVER shown.
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';

export const FALLBACK_MESSAGE =
  "I can only speak to how your skin looks and your cosmetic routine. For anything medical — like a " +
  'specific spot or change in your skin — please see a board-certified dermatologist.';

export function guardReply(text: string): { safe: string; blocked: boolean } {
  if (findDiseaseTerms(text).length > 0) {
    return { safe: FALLBACK_MESSAGE, blocked: true };
  }
  return { safe: text, blocked: false };
}
