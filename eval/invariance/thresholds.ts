// PROVISIONAL acceptance bounds for the invariance axes (spec §6c), mirroring the ownership note
// on eval/fairness/thresholds.ts: the harness reports numbers against these; the real pass/fail
// policy belongs to founders + counsel + a domain expert, with validation data.
//
// Derivation: set loose enough that today's engine passes GEOMETRIC invariance, and tight enough
// that it FAILS ILLUMINANT invariance — the defect this track exists to fix (spec F3). Tightened
// in Task 6 once the baseline report is committed.
import type { Dimension } from '../../src/content/cosmetic-vocab';

export const INVARIANCE_THRESHOLDS = {
  // Max allowed max-min score spread across an invariance sweep.
  epsilon: {
    hydration: 0.10, oiliness: 0.12, texture: 0.10, pores: 0.12,
    darkSpots: 0.08, redness: 0.08, fineLines: 0.10, darkCircles: 0.08,
  } as Record<Dimension, number>,
  // Max drift allowed in NON-target dimensions while one defect is swept.
  crossTalk: 0.07,
  // Min Spearman rho between a swept defect and its target score.
  spearmanFloor: 0.9,
  // Min spread that tone-derived quantities must RETAIN across FST I..VI after normalization —
  // guards against achieving invariance by erasing tone (spec §6b).
  tonePreservationFloor: 0.05,
} as const;

export type InvarianceThresholds = {
  epsilon: Record<Dimension, number>;
  crossTalk: number;
  spearmanFloor: number;
  tonePreservationFloor: number;
};
