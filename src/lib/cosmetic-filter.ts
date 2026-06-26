// src/lib/cosmetic-filter.ts
// Defense-in-depth: validate every user-facing label against the approved vocabulary
// AND the disease blocklist before it is persisted or displayed (CLAUDE.md §1).
import { APPROVED_LABELS, DISEASE_BLOCKLIST } from '../content/cosmetic-vocab';

export function findDiseaseTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return DISEASE_BLOCKLIST.filter((t) => {
    // Greek/Latin "-is" terms also inflect "-is -> -es" (diagnosis -> diagnoses, which is also the
    // verb form; psoriasis -> psoriases; dermatitis -> dermatites). The plain additive-suffix
    // pattern below misses those, so handle the stem explicitly for -is terms.
    const pattern = t.endsWith('is')
      ? `\\b${t.slice(0, -2)}(is|es|ises)\\b`
      : `\\b${t}(s|es|ous|tic)?\\b`;
    return new RegExp(pattern, 'i').test(lower);
  });
}

export function isApprovedLabel(label: string): boolean {
  return APPROVED_LABELS.includes(label) && findDiseaseTerms(label).length === 0;
}

export function assertCosmetic(labels: readonly string[]): void {
  for (const label of labels) {
    const bad = findDiseaseTerms(label);
    if (bad.length) throw new Error(`blocked disease term: ${bad.join(', ')}`);
    if (!isApprovedLabel(label)) throw new Error(`label not in approved vocabulary: ${label}`);
  }
}
