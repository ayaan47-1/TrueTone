// Central calibration: region geometry (fractions of the face bbox) and per-dimension
// normalization ranges. Tuned against synthetic fixtures + the fairness self-test (Task 18).
// Keeping every magic number here means tuning never edits an extractor.
// PROVISIONAL: these hi/threshold values are heuristic (chosen so the synthetic directional tests
// are non-saturated and the fairness self-test passes). They set score magnitudes, not the
// fairness property, and MUST be empirically grounded on real data before any accuracy claim
// ships (CLAUDE.md §1, §7). The fairness self-test only constrains tone-invariance, not absolute
// calibration.
import type { RegionName } from './types';

export const norm01 = (raw: number, lo: number, hi: number): number =>
  Math.min(1, Math.max(0, (raw - lo) / (hi - lo)));

// [fx, fy, fw, fh] as fractions of the bbox. Non-overlapping in x where it matters
// (tZone is a central strip; cheeks flank it; infraorbital sits above the cheeks).
export const REGION_PROPORTIONS: Record<RegionName, [number, number, number, number]> = {
  forehead: [0.25, 0.05, 0.5, 0.15],
  periocularL: [0.12, 0.3, 0.2, 0.12],
  periocularR: [0.68, 0.3, 0.2, 0.12],
  infraorbitalL: [0.18, 0.45, 0.18, 0.08],
  infraorbitalR: [0.64, 0.45, 0.18, 0.08],
  cheekL: [0.15, 0.55, 0.2, 0.18],
  cheekR: [0.65, 0.55, 0.2, 0.18],
  tZone: [0.4, 0.3, 0.2, 0.45],
};

export const CAL = {
  redness: { lo: 0, hi: 25 }, // Δa* over baseline
  darkCircles: { lo: 0, hi: 25 }, // ΔL* deficit vs baseline
  // relLift 0.2 (not the brief's literal 0.5): floorL = baselineL * (1 + relLift) is bounded above
  // by L*=100, so relLift=0.5 makes the specular floor UNREACHABLE for any baseline L* > 66.7 —
  // measured as completely dead (fraction 0 at every defect level, every illuminant) for FST I–III
  // (baseline L* on the render harness: I=87.8, II=83.0, III=74.7). Under the illuminant sweep
  // (temp x intensity) the default-tone baseline L* itself ranges ~53-86 as exposure rises, so
  // relLift also needs enough margin that a bright-but-clean exposure doesn't blow past floorL —
  // relLift <= 0.1 leaves illuminant spread at ~0.34 (still failing); relLift = 0.2 brings it to
  // ~0.04. Residual limitation: at 0.2 the floor is only reachable up to baseline L* ~83, so the
  // two lightest Fitzpatrick types (I, II) stay marginal-to-dead for THIS defect under normal
  // (non-boosted) exposure — a real, currently-untested gap flagged for follow-up with real
  // validation data, not hidden. See task-7-report.md for the measured sweep.
  oiliness: { relLift: 0.2, satThr: 0.15, lo: 0, hi: 0.25 }, // relative specular fraction
  texture: { lo: 0, hi: 0.3 }, // mean |laplacian| / mean luma (tone-relative)
  pores: { relThr: 0.06, lo: 0, hi: 0.3 }, // RELATIVE local-contrast density
  fineLines: { lo: 0, hi: 0.3 }, // tone-relative horizontal gradient
  darkSpots: { relThr: 0.08, lo: 0, hi: 0.15 }, // fraction darker than baseline L* by relThr (relative)
  hydration: { lo: 0, hi: 0.3 }, // inverse tone-relative micro-texture
} as const;
