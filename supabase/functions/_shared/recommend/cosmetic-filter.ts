// SOURCE OF TRUTH: src/lib/cosmetic-filter.ts — this copy is kept in sync manually.
// Defense-in-depth: validate every user-facing label against the approved vocabulary
// AND the disease blocklist before it is persisted or displayed (CLAUDE.md §1).
import { APPROVED_LABELS, DISEASE_BLOCKLIST } from './cosmetic-vocab.ts';

export function findDiseaseTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return DISEASE_BLOCKLIST.filter((t) => new RegExp(`\\b${t}\\b`).test(lower));
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
