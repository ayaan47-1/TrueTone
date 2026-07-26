// Pure pixel/region readers over an RGBA RgbImage. All region functions clamp to bounds.
import type { RgbImage, Rect, Lab, SkinBaseline } from './types';
import { srgbToLab, srgbToLinear } from './color';

export function clampRect(r: Rect, w: number, h: number): Rect {
  const x = Math.max(0, Math.min(Math.round(r.x), w - 1));
  const y = Math.max(0, Math.min(Math.round(r.y), h - 1));
  const rw = Math.max(1, Math.min(Math.round(r.w), w - x));
  const rh = Math.max(1, Math.min(Math.round(r.h), h - y));
  return { x, y, w: rw, h: rh };
}

export function rgbAt(img: RgbImage, x: number, y: number): [number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

export function lumaAt(img: RgbImage, x: number, y: number): number {
  const i = (y * img.width + x) * 4;
  return (0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]) / 255;
}

export function meanLab(img: RgbImage, rect: Rect): Lab {
  const r = clampRect(rect, img.width, img.height);
  let L = 0;
  let a = 0;
  let b = 0;
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const [rr, gg, bb] = rgbAt(img, x, y);
      const lab = srgbToLab(rr, gg, bb);
      L += lab.L;
      a += lab.a;
      b += lab.b;
      n++;
    }
  }
  return { L: L / n, a: a / n, b: b / n };
}

// Region redness statistic: log(ΣR / ΣG) over LINEAR (gamma-decoded) channel sums — a ratio of
// SUMS, not a mean of per-pixel log(R/G). redness (Task 12b) differences this against the
// person's own baseline logRG.
//
// This is deliberately NOT "average the per-pixel log ratio", and NOT that average with clipped
// pixels excluded/down-weighted (both were tried — see task-12b-report.md for the full sweep).
// Averaging per-pixel logs is fragile under 8-bit channel saturation: excluding or down-weighting
// near-255 pixels to curb EXPOSURE-driven bias changes which population the average is taken
// over, and a stronger redness defect saturates its OWN reddest pixels first — so the same
// exclusion that helps exposure-invariance actively suppresses the signal exactly where the
// defect is strongest, breaking monotonicity (measured Spearman rho 0.6 against a 0.9 floor).
// A ratio of channel SUMS degrades gracefully instead: a saturated pixel still contributes its
// true (capped, i.e. slightly-too-low) value to the sum rather than being dropped or reweighted,
// so growing saturation shrinks the signal smoothly rather than shifting between populations.
// Measured: sum-of-channels gives an illuminant-axis redness spread of ~0.074 (under the 0.08
// bound) AND a perfectly monotonic own-defect sweep (rho 1.0), where every per-pixel-averaging
// variant tried failed one or the other.
export function regionLogChromaRG(img: RgbImage, rect: Rect): number {
  const r = clampRect(rect, img.width, img.height);
  let sumR = 0;
  let sumG = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const [rr, gg, bb] = rgbAt(img, x, y);
      const { R, G } = srgbToLinear(rr, gg, bb);
      sumR += R;
      sumG += G;
    }
  }
  const EPS = 1e-6; // guards log(0) / divide-by-zero on a pure-black region; negligible otherwise
  return Math.log((sumR + EPS) / (sumG + EPS));
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function laplacianEnergy(img: RgbImage, rect: Rect): number {
  const r = clampRect(rect, img.width, img.height);
  let sum = 0;
  let n = 0;
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const lap =
        4 * lumaAt(img, x, y) -
        lumaAt(img, x - 1, y) -
        lumaAt(img, x + 1, y) -
        lumaAt(img, x, y - 1) -
        lumaAt(img, x, y + 1);
      sum += Math.abs(lap);
      n++;
    }
  }
  return n ? sum / n : 0;
}

export function meanLuma(img: RgbImage, rect: Rect): number {
  const r = clampRect(rect, img.width, img.height);
  let sum = 0;
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      sum += lumaAt(img, x, y);
      n++;
    }
  }
  return n ? sum / n : 0;
}

// Weber-style relative texture: high-frequency energy divided by local brightness, so the
// measure is invariant to overall skin lightness. This is the fairness fix — absolute Laplacian
// energy scales with luminance, biasing texture/hydration across Fitzpatrick tones.
export function microContrast(img: RgbImage, rect: Rect): number {
  const lum = meanLuma(img, rect);
  return lum > 0 ? laplacianEnergy(img, rect) / lum : 0;
}

export function gradientEnergy(img: RgbImage, rect: Rect): number {
  const r = clampRect(rect, img.width, img.height);
  let sum = 0;
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x + 1; x < r.x + r.w; x++) {
      sum += Math.abs(lumaAt(img, x, y) - lumaAt(img, x - 1, y));
      n++;
    }
  }
  return n ? sum / n : 0;
}

export function localContrastDensity(img: RgbImage, rect: Rect, thr: number): number {
  const r = clampRect(rect, img.width, img.height);
  let count = 0;
  let n = 0;
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const localMean =
        (lumaAt(img, x - 1, y) + lumaAt(img, x + 1, y) + lumaAt(img, x, y - 1) + lumaAt(img, x, y + 1)) / 4;
      if (Math.abs(lumaAt(img, x, y) - localMean) > thr) count++;
      n++;
    }
  }
  return n ? count / n : 0;
}

// Weber-relative contrast density: |luma - localMean| / localMean, so the threshold means "this
// pixel differs from its neighbours by X PERCENT" rather than "by X absolute luma". The absolute
// form under-detects on deep tones and over-detects on bright exposures (spec F3).
export function relativeContrastDensity(img: RgbImage, rect: Rect, relThr: number): number {
  const r = clampRect(rect, img.width, img.height);
  let count = 0;
  let n = 0;
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const localMean =
        (lumaAt(img, x - 1, y) + lumaAt(img, x + 1, y) + lumaAt(img, x, y - 1) + lumaAt(img, x, y + 1)) / 4;
      if (localMean > 0 && Math.abs(lumaAt(img, x, y) - localMean) / localMean > relThr) count++;
      n++;
    }
  }
  return n ? count / n : 0;
}

// Mean horizontal gradient divided by mean luma — same Weber normalization as microContrast.
export function relativeGradientEnergy(img: RgbImage, rect: Rect): number {
  const lum = meanLuma(img, rect);
  return lum > 0 ? gradientEnergy(img, rect) / lum : 0;
}

// Smooth 0..1 ramp (Hermite), 0 at t<=0, 1 at t>=1. Used to turn a hard threshold into a soft one.
const smoothstep01 = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

// Specular highlight fraction relative to the person's own skin baseline, not an absolute or
// proportional lightness threshold.
//
// A specular highlight adds the illuminant's radiance on top of the diffuse skin reflection —
// approximately a constant increment in LINEAR luminance for a given light. L* is a compressive
// (roughly cube-root) transform, so that constant linear increment maps to a SMALLER L* delta as
// L* rises. A proportional lightness floor (baselineL * (1 + relLift)) therefore demands the most
// headroom exactly where the least exists: for light skin (high baseline L*) the floor can exceed
// CIELAB's L*=100 ceiling, making the gate structurally unreachable.
//
// Chroma is the fix. Specular reflection carries the ILLUMINANT's colour, not the skin's, so a
// specular pixel is markedly LESS chromatic than the surrounding skin on every tone — deep skin
// has high chroma, light skin lower, but a highlight drives both toward the illuminant's
// near-neutral.
//
// *** CORRECTION (2026-07-26). The sentence that used to close this paragraph -- "Chroma drop
// measured against the subject's own baseline chroma is therefore tone-invariant, where a
// lightness threshold (absolute or proportional) is not" -- IS FALSE. It was measured false, then
// proved false analytically. Do not restore it. ***
//
// Under the dichromatic reflection model a pixel is diffuse + specular, so its chroma is about
// C_skin * D/(D+S) for diffuse radiance D and specular radiance S. Normalising by baseline chroma
// removes the dependence on C_skin but NOT on D -- and D is precisely what skin tone is. The
// relative chroma drop computed below is therefore an estimator of S/(D+S), which at a FIXED
// specular radiance runs 0.278 (FST I) -> 0.795 (FST VI): a 2.9x climb with darkness.
//
// Worse than a bias, the gate is structurally UNREACHABLE on light skin. Firing requires
// C_skin*D/(D+S) < C_skin*(1 - chromaDrop), i.e. S > D * chromaDrop/(1 - chromaDrop) = 1.857*D at
// chromaDrop=0.65. But an 8-bit pixel caps at full white, so the available specular radiance is at
// most 1 - D. Comparing the two, with D = ((baselineL* + 16)/116)^3:
//
//   FST   D        S required   S available   verdict
//   I     0.7167   1.3309       0.2833        impossible -- needs 4.7x the range that exists
//   II    0.6216   1.1543       0.3784        impossible -- 3.05x
//   III   0.4787   0.8889       0.5213        impossible -- 1.71x
//   IV    0.3250   0.6035       0.6750        marginal -- needs 89% of available range
//   V     0.1951   0.3623       0.8049        reachable -- 45%
//   VI    0.1055   0.1959       0.8945        reachable -- 22%
//
// So on FST I-III no unclipped pixel can EVER satisfy this gate, at any shine level. Measurement
// agrees exactly: of the weight this gate admits at defect 0.5, the fraction carried by
// fully-unclipped pixels is 0.0000 at FST I, II and III. Every count it returns on light skin comes
// from a CLIPPED pixel, whose chroma reads as 0 only because the sensor ran out of range.
//
// Stated plainly: for FST I-III, `oiliness` is currently a saturation detector, not a shine
// detector. It is not merely biased -- it measures a different physical quantity there. Any
// user-facing oiliness claim is unsupported on light skin until the gate is replaced (tracked
// separately: recover S and D under the dichromatic model and normalise S by an illuminant
// estimate, not by (D+S)).
//
// Excluding clipped pixels does NOT fix this and was tried and reverted. Dropping any-channel-
// clipped pixels (the capture gate's rule) removed 100% of the admitted weight at FST II/III and
// collapsed the monotonic axis (Spearman rho 0.9535 -> 0.0000). Dropping only fully-white pixels
// left the fairness axis unchanged at 0.1188 but made maximum shine unreadable on FST I-IV
// (0.31 -> 0.027 at FST I, defect=1) and WIDENED the max-defect tone spread 0.20 -> 0.291. The
// signal on light skin lives in the clipped pixels, so no exclusion rule can recover it.
//
// Harness note: the renderer (eval/render/face.ts:213) adds specularity as a channel-flat scalar
// BEFORE the illuminant multiply, so the specular term carries the illuminant's chromaticity
// exactly -- the dichromatic model, literally. A (skin, illuminant)-basis estimator would be
// inverting the renderer's own generative model, so synthetic agreement proves less than it looks.
//
// Gate on both, each relative to the subject's own baseline:
//   1. Chroma drop:  C* < baselineC* * (1 - chromaDrop), where C* = hypot(a*, b*).
//   2. Lightness lift: L* > baselineL* + lift — ADDITIVE, not multiplicative, and small enough to
//      stay reachable at FST I's baseline of ~88.
//
// Each gate is a SMOOTH ramp centred on its threshold, not a hard 0/1 cut. The rendered specular
// lobe (eval/render/face.ts's ndh^28 term) is extremely concentrated in angle, so at a hard cutoff
// the fraction of qualifying pixels is exactly zero until the defect magnitude first lets ANY
// pixel cross both thresholds, then jumps — a real plateau-then-jump, not noise, that defeats
// monotonic tracking at coarse defect steps. A smooth ramp accumulates partial credit from
// near-threshold pixels before any pixel fully qualifies, restoring a monotonic response, without
// changing what is being measured (still both quantities, still relative to the subject's own
// baseline — see task-7b-report.md for the measured before/after).
export function specularFraction(
  img: RgbImage,
  rect: Rect,
  baseline: SkinBaseline,
  chromaDrop: number,
  lift: number,
): number {
  const r = clampRect(rect, img.width, img.height);
  const baselineC = Math.hypot(baseline.a, baseline.b);
  const chromaCeiling = baselineC * (1 - chromaDrop);
  const floorL = baseline.L + lift;
  const chromaBand = Math.max(1e-6, baselineC * chromaDrop);
  const liftBand = Math.max(1e-6, lift);
  let sum = 0;
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const [R, G, B] = rgbAt(img, x, y);
      const lab = srgbToLab(R, G, B);
      const chroma = Math.hypot(lab.a, lab.b);
      const chromaWeight = smoothstep01((chromaCeiling - chroma) / chromaBand + 0.5);
      const liftWeight = smoothstep01((lab.L - floorL) / liftBand + 0.5);
      sum += chromaWeight * liftWeight;
      n++;
    }
  }
  return n ? sum / n : 0;
}
