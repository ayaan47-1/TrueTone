// Pure pixel/region readers over an RGBA RgbImage. All region functions clamp to bounds.
import type { RgbImage, Rect, Lab, SkinBaseline } from './types';
import { srgbToLab } from './color';

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
// near-neutral. Chroma drop measured against the subject's own baseline chroma is therefore
// tone-invariant, where a lightness threshold (absolute or proportional) is not.
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
