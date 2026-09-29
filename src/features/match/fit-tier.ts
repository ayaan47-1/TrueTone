// src/features/match/fit-tier.ts
// Maps the 40..99 compatibility score (scoring.ts) to a qualitative tier for display. The
// number itself stays internal — it ranks the shelf but is never rendered (ruling §4).
//
// Thresholds follow how scoring.ts builds the score (99 − 8 per shade step − undertone
// penalty 0/4/6/10/14, then preference nudges):
//   great ≥ 90 — exact shade, or one shade step off with the same undertone (91)
//   good  75..89 — two steps off same undertone (83), or one step off with an undertone gap
//   try   < 75 — three+ steps off, a warm/cool clash plus distance, or a skipped trait
import type { FitTier } from '../../content/makeup-vocab';

export const GREAT_MATCH_MIN = 90;
export const GOOD_MATCH_MIN = 75;

/** Qualitative tier for a fit score. Pure. */
export function fitTier(score: number): FitTier {
  if (score >= GREAT_MATCH_MIN) return 'great';
  if (score >= GOOD_MATCH_MIN) return 'good';
  return 'try';
}
