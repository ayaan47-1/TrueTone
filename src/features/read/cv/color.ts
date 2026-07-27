// sRGB (0..255) → CIELAB (D65). L* lightness, a* green↔red, b* blue↔yellow.
// a* is the redness axis; L* drives dark-circle/dark-spot deltas. Pure + standard.
//
// Also exports the LINEAR (gamma-decoded) building blocks CIELAB is computed from: `toLinear`,
// `srgbToLinear`, `relativeLuminance`, `logChromaRG`. Task 12b needs these directly for darkSpots
// and redness — L*/a* apply a compressive, roughly-cube-root transform (`f` below) to the linear
// tristimulus values BEFORE differencing, so a uniform exposure gain (which scales the linear
// values by a constant k) does not scale L*/a* by that same k. Ratios/differences taken in the
// LINEAR domain, before `f` is applied, are exactly gain-invariant instead.
import type { Lab } from './types';

export const toLinear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

export interface LinearRgb {
  R: number;
  G: number;
  B: number;
}

// Gamma-decoded (linear-light) RGB, each roughly in [0,1]. This is the space in which a uniform
// exposure gain is an exact multiplicative scale on every channel — CIELAB is not.
export function srgbToLinear(r: number, g: number, b: number): LinearRgb {
  return { R: toLinear(r), G: toLinear(g), B: toLinear(b) };
}

// CIE relative luminance (Rec.709/sRGB primaries) — the same Y this file already computed
// internally en route to L*, exposed directly. darkSpots (Task 12b) thresholds on the RATIO
// Y / Y_baseline rather than an L* difference: under Y -> kY, both baselineY and a pixel's Y
// scale by the same k, so the ratio (and any threshold on it) is exactly unchanged.
export function relativeLuminance(r: number, g: number, b: number): number {
  const { R, G, B } = srgbToLinear(r, g, b);
  return R * 0.2126 + G * 0.7152 + B * 0.0722;
}

// log(linear R / linear G) — essentially the dermatological erythema index. Under R,G -> kR,kG
// (a uniform exposure gain), log(kR/kG) = log(R/G): the gain cancels before any nonlinear step
// runs, unlike a* = 500*(f(X/Xn) - f(Y/Yn)), which compresses X and Y individually before
// subtracting. redness (Task 12b) differences this against the person's own baseline, so tone
// still cancels the way a*-baseline.a did.
export function logChromaRG(r: number, g: number, b: number): number {
  const { R, G } = srgbToLinear(r, g, b);
  const EPS = 1e-6; // guards log(0) / divide-by-zero on a pure-black pixel; negligible otherwise
  return Math.log((R + EPS) / (G + EPS));
}

export function srgbToLab(r: number, g: number, b: number): Lab {
  const { R, G, B } = srgbToLinear(r, g, b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
