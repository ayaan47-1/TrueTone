// src/content/ingredients/version.ts
// Ingredient id migrations (design E13). When a taxonomy update renames an id, add `old: new` here
// so stored profiles follow it. Removed ids need no entry: parseProfile moves any id the
// dictionary no longer knows into `unresolved`, so a user's flag is never silently dropped.
export { TAXONOMY_VERSION } from './dictionary';

export const INGREDIENT_ID_MIGRATIONS: Readonly<Record<string, string>> = {};

export function migrateIngredientId(
  id: string,
  map: Readonly<Record<string, string>> = INGREDIENT_ID_MIGRATIONS,
): string {
  return Object.prototype.hasOwnProperty.call(map, id) ? map[id] : id;
}
