// src/features/allergens/profile.ts
// The user's allergen profile (design §2.2) + pure, immutable updates. On-device only; never sent
// to Supabase, the chat function, share cards or Community (check-allergen-isolation).
import { isFlaggableGroup, type AllergenGroupId } from '../../content/ingredients/allergen-groups';
import { ingredientById, TAXONOMY_VERSION, type IngredientId } from '../../content/ingredients/dictionary';
import { migrateIngredientId } from '../../content/ingredients/version';
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

const unique = (xs: readonly string[]): string[] => xs.filter((x, i) => xs.indexOf(x) === i);

// Dictionary ids are lowercase words joined by underscores/hyphens (see dictionary.ts).
export const ID_SHAPE = /^[a-z0-9][a-z0-9_-]{0,127}$/;

/**
 * Stored ingredient ids → dictionary ids + readable names for ids the dictionary no longer knows
 * (design E13: moved to `unresolved`, never dropped). A retired id was trusted when saved, so it
 * skips the free-text rules for user typing. Write-time caps are not re-applied on read. Returns
 * null when a stored id is not id-shaped: the value is corrupt, so the read fails closed.
 */
function readFlags(ingredientIds: string[], unresolved: string[]): Pick<AllergenProfile, 'ingredients' | 'unresolved'> | null {
  if (ingredientIds.some((id) => !ID_SHAPE.test(id))) return null;
  const ids = ingredientIds.map((id) => migrateIngredientId(id));
  const known = ids.filter((id) => ingredientById(id));
  const retired = ids.filter((id) => !ingredientById(id)).map((id) => id.replace(/[_-]+/g, ' ').trim());
  const typed = unresolved.map(validateFreeText).flatMap((v) => (v.ok ? [v.value] : []));
  return { ingredients: unique(known), unresolved: unique([...typed, ...retired]) };
}

/** Validate stored JSON; malformed entries are dropped, never trusted; retired ids are kept as names. */
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
  const flags = readFlags(strings(o.ingredients), strings(o.unresolved));
  if (!flags) return null;
  return {
    ...withGroups,
    ...flags,
    display: o.display === 'flag' ? 'flag' : 'hide',
    unknownDisplay: o.unknownDisplay === 'hide' ? 'hide' : 'show',
    taxonomyVersion: typeof o.taxonomyVersion === 'string' ? o.taxonomyVersion : TAXONOMY_VERSION,
  };
}
