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
  // Max allowed spread, across Fitzpatrick I..VI, of a dimension's score at a FIXED non-zero
  // defect level. Complements tonePreservationFloor (which renders a fixed mid-strength defect
  // BLEND -- not defect=0 as this comment used to claim -- and floors mean IMAGE LUMA separation) with
  // the actual fairness claim: the SAME defect strength should read as the SAME score on every
  // skin tone.
  //
  // Set from the Task 14c baseline measurement (defectToneFairnessAxis, TONE_RESPONSE_DEFECT=0.5),
  // which falls into two clean clusters with a >2x gap between them — not tuned to flatter any
  // dimension:
  //   fineLines 0.0209, darkSpots 0.0334               <- low cluster
  //   texture/hydration 0.0632, redness 0.0651, pores 0.0724, darkCircles 0.0758, oiliness 0.1188
  //                                                      <- high cluster
  // 0.05 sits in the gap: clears the low cluster with ~35-58% headroom, and is tight enough that
  // SIX of eight dimensions genuinely fail, including redness (0.0651) AND oiliness (0.1188,
  // worse than redness and NOT monotonic in tone — U-shaped, see axes.test.ts). This axis is
  // therefore INTENTIONALLY LEFT FAILING, same precedent as the illuminant axis at the Task 6
  // baseline: a passing axis here would hide a measured, real cross-tone response gap.
  toneResponseSpread: 0.05,
} as const;

export type InvarianceThresholds = {
  epsilon: Record<Dimension, number>;
  crossTalk: number;
  spearmanFloor: number;
  tonePreservationFloor: number;
  toneResponseSpread: number;
};
