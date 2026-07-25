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
  // Task 7b: chroma-drop, not a lightness lift, is what makes oiliness detectable on every tone.
  // A specular highlight adds the illuminant's radiance on top of the diffuse reflection — roughly
  // a CONSTANT increment in linear luminance. L* is a compressive (~cube-root) transform, so that
  // constant linear increment maps to a SMALLER L* delta as L* rises. Any PROPORTIONAL lightness
  // floor (the old floorL = baselineL * (1 + relLift)) therefore demands the most headroom exactly
  // where the least exists: at relLift=0.2 the floor for FST I (baseline L* 87.8) was 105.4 —
  // above CIELAB's L*=100 ceiling — so FST I scored exactly 0.0000 at every defect level while
  // sensitivity rose monotonically for darker tones (measured spread 0.0000..0.5511 at max
  // defect). No relLift value fixes this: any proportional lift has some baseline above which the
  // floor exceeds 100, and lowering it enough to reach FST I fires on ordinary bright skin at deep
  // tones.
  //
  // Specular reflection carries the ILLUMINANT's colour, not the skin's, so a specular pixel is
  // markedly LESS chromatic than the surrounding skin on every tone — deep skin has high chroma,
  // light skin lower, but a highlight drives both toward the illuminant's near-neutral. Chroma
  // drop relative to the subject's OWN baseline chroma (C* = hypot(a*, b*)) is tone-invariant by
  // construction, so it replaces the lightness floor as the primary gate; an ADDITIVE (not
  // proportional) lightness lift stays as a secondary check, cheap headroom against non-specular
  // brightness even at FST I's baseline of ~88.
  //
  // `specularFraction` (sampling.ts) applies both gates as a SMOOTH ramp, not a hard 0/1 cut, for
  // a reason distinct from fairness: the render's specular lobe is extremely concentrated in angle
  // (ndh^28 in eval/render/face.ts), so with a hard cutoff the qualifying-pixel fraction is exactly
  // zero until the defect first lets ANY pixel cross both thresholds, then jumps. That plateau
  // broke Spearman monotonicity at the coarse defect steps eval/invariance's monotonicAxis sweeps
  // (0, 0.25, 0.5, 0.75, 1) — measured rho=0.8944 against a 0.9 floor for every chromaDrop that
  // also passed the fairness spread test below, and no chromaDrop passed both under a hard cutoff
  // (below ~0.43 fixes monotonicity but the max-defect/FST ratio tops out ~0.33, short of the ~0.4
  // a hard gate needs; at/above ~0.43 the ratio clears 0.4 but the plateau reappears — a genuine
  // conflict, not a tuning gap). The smooth ramp accumulates partial credit from near-threshold
  // pixels before any pixel fully qualifies, which removes the plateau and restores monotonicity
  // without changing what is measured.
  //
  // Swept chromaDrop in [0.35, 0.7] x lift in [3, 9] against: (a) max-defect fraction spread across
  // all six FST (best ratio of min-tone to spread around chromaDrop=0.6-0.65; lift has no effect on
  // this axis — the specular lobe's radiance increment clears any lift in range on every tone
  // tested), (b) Spearman rho of the swept defect at FST III (>=0.9747 for chromaDrop>=0.5 under
  // the smooth ramp, vs. exactly 0.8944 under the old hard cutoff), and (c) the illuminant sweep
  // (temp x intensity) at FST III. chromaDrop=0.65 + lift=9 gives max-defect fractions
  // [0.0908, 0.0735, 0.0494, 0.0332, 0.0396, 0.0922] for FST I-VI (min/spread ratio 0.563); hi=0.29
  // turns that into scores of roughly 0.31/0.25/0.17/0.11/0.14/0.32 — every tone > 0.1, spread
  // ~0.20 (< 0.25) — a clean face reading exactly 0 on every tone, and an illuminant-axis oiliness
  // spread of ~0.069 (well under the 0.12 epsilon; the prior task's 0.0396 was measured under the
  // old, now-replaced, proportional-lift formulation and is not directly comparable). See
  // task-7b-report.md for the full per-tone sweep table and before/after numbers.
  oiliness: { chromaDrop: 0.65, lift: 9, lo: 0, hi: 0.29 }, // chroma-drop + additive lightness lift (smooth gate)
  texture: { lo: 0, hi: 0.3 }, // mean |laplacian| / mean luma (tone-relative)
  pores: { relThr: 0.06, lo: 0, hi: 0.3 }, // RELATIVE local-contrast density
  fineLines: { lo: 0, hi: 0.3 }, // tone-relative horizontal gradient
  darkSpots: { relThr: 0.08, lo: 0, hi: 0.15 }, // fraction darker than baseline L* by relThr (relative)
  hydration: { lo: 0, hi: 0.3 }, // inverse tone-relative micro-texture
} as const;
