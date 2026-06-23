// Central calibration: region geometry (fractions of the face bbox) and per-dimension
// normalization ranges. Tuned against synthetic fixtures + the fairness self-test (Task 18).
// Keeping every magic number here means tuning never edits an extractor.
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
  oiliness: { lumaThr: 0.8, satThr: 0.15, lo: 0, hi: 0.25 }, // bright low-sat fraction
  texture: { lo: 0, hi: 0.3 }, // mean |laplacian| / mean luma (tone-relative)
  pores: { thr: 0.06, lo: 0, hi: 0.3 }, // local-contrast density
  fineLines: { lo: 0, hi: 0.12 }, // mean horizontal gradient
  darkSpots: { relThr: 0.08, lo: 0, hi: 0.15 }, // fraction darker than baseline L* by relThr (relative)
  hydration: { lo: 0, hi: 0.3 }, // inverse tone-relative micro-texture
} as const;
