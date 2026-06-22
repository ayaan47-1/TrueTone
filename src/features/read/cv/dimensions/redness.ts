// Redness = elevation of a* in the central T-zone relative to the person's own baseline a*.
// Baseline-relative ⇒ skin tone cancels (fairness).
import type { RgbImage, Regions, SkinBaseline } from '../types';
import { meanLab } from '../sampling';
import { norm01, CAL } from '../calibration';

export function redness(img: RgbImage, regions: Regions, baseline: SkinBaseline): number {
  const a = meanLab(img, regions.tZone).a;
  return norm01(a - baseline.a, CAL.redness.lo, CAL.redness.hi);
}
