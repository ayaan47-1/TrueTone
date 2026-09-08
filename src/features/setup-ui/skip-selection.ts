// src/features/setup-ui/skip-selection.ts
// Pure multi-select toggle for the optional Setup skips. Immutable — returns a new
// array so screen state updates never mutate prior state.
import type { Skip } from '../../content/makeup-vocab';

/** Add the skip if absent, remove it if present. Never mutates `selected`. */
export function toggleSkip(selected: readonly Skip[], skip: Skip): Skip[] {
  return selected.includes(skip) ? selected.filter((s) => s !== skip) : [...selected, skip];
}
