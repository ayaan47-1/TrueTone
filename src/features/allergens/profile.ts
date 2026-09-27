// src/features/allergens/profile.ts
// The user's allergen profile (design §2.2) + pure, immutable updates. On-device only; never sent
// to Supabase, the chat function, share cards or Community (check-allergen-isolation).
import { isFlaggableGroup, type AllergenGroupId } from '../../content/ingredients/allergen-groups';
import { ingredientById, TAXONOMY_VERSION, type IngredientId } from '../../content/ingredients/dictionary';
import { validateFreeText } from './search';

export type AllergenAnswer = 'yes' | 'no' | 'skipped';

export interface AllergenProfile {
  readonly version: 1;
  /** A UX flag, not health data: 'no'/'skipped' only mean "don't show the intake again". */
  readonly answer: AllergenAnswer;
  readonly groups: readonly AllergenGroupId[];
  readonly ingredients: readonly IngredientId[];
  /** Validated free-text names, matched by exact normalized name only. */
  readonly unresolved: readonly string[];
  readonly display: 'hide' | 'flag';
  readonly unknownDisplay: 'show' | 'hide';
  readonly taxonomyVersion: string;
  readonly updatedAt: string;
}

export const MAX_UNRESOLVED = 20;
export const MAX_INGREDIENTS = 40;

export function emptyProfile(answer: AllergenAnswer, now: string): AllergenProfile {
  return {
    version: 1, answer, groups: [], ingredients: [], unresolved: [],
    display: 'hide', unknownDisplay: 'show', taxonomyVersion: TAXONOMY_VERSION, updatedAt: now,
  };
}

/** Only a saved selection is health data (and needs the wa_health consent). */
export function hasHealthData(p: AllergenProfile): boolean {
  return flaggedCount(p) > 0;
}

export function flaggedCount(p: AllergenProfile): number {
  return p.groups.length + p.ingredients.length + p.unresolved.length;
}

export function toggleGroup(p: AllergenProfile, id: string): AllergenProfile {
  if (!isFlaggableGroup(id)) return p; // referral-only groups are never stored
  const groups = p.groups.includes(id) ? p.groups.filter((g) => g !== id) : [...p.groups, id];
  return { ...p, groups };
}

export function addIngredient(p: AllergenProfile, id: string): AllergenProfile {
  if (!ingredientById(id) || p.ingredients.includes(id) || p.ingredients.length >= MAX_INGREDIENTS) return p;
  return { ...p, ingredients: [...p.ingredients, id] };
}

export function addUnresolved(p: AllergenProfile, text: string): AllergenProfile {
  const v = validateFreeText(text);
  if (!v.ok || p.unresolved.includes(v.value) || p.unresolved.length >= MAX_UNRESOLVED) return p;
  return { ...p, unresolved: [...p.unresolved, v.value] };
}

export function removeEntry(p: AllergenProfile, kind: 'ingredient' | 'unresolved', value: string): AllergenProfile {
  return kind === 'ingredient'
    ? { ...p, ingredients: p.ingredients.filter((i) => i !== value) }
    : { ...p, unresolved: p.unresolved.filter((u) => u !== value) };
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Validate stored JSON; unknown ids and malformed entries are dropped, never trusted. */
export function parseProfile(raw: string): AllergenProfile | null {
  let o: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    o = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (o.version !== 1 || !['yes', 'no', 'skipped'].includes(o.answer as string)) return null;
  const base = emptyProfile(o.answer as AllergenAnswer, typeof o.updatedAt === 'string' ? o.updatedAt : '');
  const withGroups = strings(o.groups).reduce((acc, g) => (acc.groups.includes(g as AllergenGroupId) ? acc : toggleGroup(acc, g)), base);
  const withIngredients = strings(o.ingredients).reduce(addIngredient, withGroups);
  const withText = strings(o.unresolved).reduce(addUnresolved, withIngredients);
  return {
    ...withText,
    display: o.display === 'flag' ? 'flag' : 'hide',
    unknownDisplay: o.unknownDisplay === 'hide' ? 'hide' : 'show',
    taxonomyVersion: typeof o.taxonomyVersion === 'string' ? o.taxonomyVersion : TAXONOMY_VERSION,
  };
}
