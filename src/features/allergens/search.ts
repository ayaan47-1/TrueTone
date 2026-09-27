// src/features/allergens/search.ts
// Pure ingredient search + free-text validation (design §3.2). On-device; no network.
import { INGREDIENTS, type Ingredient } from '../../content/ingredients/dictionary';
import { findDiseaseTerms } from '../../lib/cosmetic-filter';
import { findMedicalClaims } from '../../content/medical-claims';

export const MAX_FREE_TEXT_CHARS = 60;
export const MAX_FREE_TEXT_WORDS = 6;
const NAME_SHAPE = /^[a-z0-9 \-()/,]+$/;

export function normalizeName(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function names(i: Ingredient): string[] {
  return [i.inci, ...i.aliases, ...i.tradeNames].map(normalizeName);
}

/** True if a and b differ by at most one insert, delete or substitution. */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function matches(name: string, q: string): boolean {
  if (name.includes(q)) return true;
  if (q.length < 5) return false;
  return name.split(/[ ,/()-]+/).some((word) => withinOneEdit(word, q)) || withinOneEdit(name, q);
}

export function searchIngredients(query: string, limit = 8): Ingredient[] {
  const q = normalizeName(query);
  if (!q) return [];
  return INGREDIENTS.filter((i) => names(i).some((n) => matches(n, q))).slice(0, limit);
}

export type FreeTextResult = { ok: true; value: string } | { ok: false };

/** Free text is health data: accept only an ingredient-name shape, never medical detail. */
export function validateFreeText(text: string): FreeTextResult {
  const value = normalizeName(text);
  if (!value || value.length > MAX_FREE_TEXT_CHARS) return { ok: false };
  if (value.split(' ').length > MAX_FREE_TEXT_WORDS) return { ok: false };
  if (!NAME_SHAPE.test(value)) return { ok: false };
  if (findDiseaseTerms(value).length > 0 || findMedicalClaims(value).length > 0) return { ok: false };
  return { ok: true, value };
}
