// Redness = elevation of log-chromaticity (linear R/G) in the central T-zone relative to the
// person's own baseline. Baseline-relative ⇒ skin tone cancels (fairness).
//
// Task 12b: this used to difference Δa* (CIELAB). a* = 500*(f(X/Xn) - f(Y/Yn)) applies a
// compressive, roughly-cube-root transform f to each of the (linear) tristimulus values X and Y
// BEFORE subtracting. Under a uniform exposure gain, X and Y scale by the same factor — their
// RATIO is preserved — but f is nonlinear, so f(X) and f(Y) do not each scale by that factor, and
// the difference (hence a*, hence Δa*) drifts. Measured illuminant-axis spread was 0.0875 against
// a 0.08 bound, ~90% of it from the intensity (exposure) axis alone (temperature-only was 0.0083).
//
// log(linear R / linear G) fixes this: under R,G -> kR,kG, log(kR/kG) = log(R/G) exactly — the
// gain cancels in the ratio before any nonlinear step runs. This is essentially the
// dermatological erythema index, computed here in the LINEAR (gamma-decoded) domain because that
// is the space in which the render engine's exposure gain is an exact multiplicative scale.
//
// The T-zone reading is a ratio of SUMMED channels (sampling.ts's regionLogChromaRG), not a mean
// of per-pixel log ratios — see that function's comment for why: averaging per-pixel logs is
// fragile under 8-bit channel saturation in exactly the way that broke either exposure-invariance
// or the dimension's own monotonic response to its own defect, depending on how clipped pixels
// were handled. A sum-based ratio degrades gracefully under partial saturation instead.
import type { RgbImage, Regions, SkinBaseline } from '../types';
import { regionLogChromaRG } from '../sampling';
import { norm01, CAL } from '../calibration';

export function redness(img: RgbImage, regions: Regions, baseline: SkinBaseline): number {
  const rg = regionLogChromaRG(img, regions.tZone);
  return norm01(rg - baseline.logRG, CAL.redness.lo, CAL.redness.hi);
}
