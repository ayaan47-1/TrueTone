// src/features/preferences/preferences-types.ts
// Structured Setup answers — the persisted onboarding preferences (NOT free text).
import type { Goal, Coverage, Skip } from '../../content/makeup-vocab';

export interface SetupAnswers {
  /** Setup 1 — goals (multi-select). */
  goals: readonly Goal[];
  /** Setup 2 — coverage (single-select). */
  coverage: Coverage;
  /** Setup 2 — "anything to skip" (multi-select). */
  skips: readonly Skip[];
}

export const DEFAULT_SETUP_ANSWERS: SetupAnswers = { goals: [], coverage: 'everyday', skips: [] };
