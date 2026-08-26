// src/features/setup-ui/goal-selection.ts
// Pure multi-select toggle for Setup 1 goals. Immutable — returns a new array so
// screen state updates never mutate prior state.
import type { Goal } from '../../content/makeup-vocab';

/** Add the goal if absent, remove it if present. Never mutates `selected`. */
export function toggleGoal(selected: readonly Goal[], goal: Goal): Goal[] {
  return selected.includes(goal) ? selected.filter((g) => g !== goal) : [...selected, goal];
}
