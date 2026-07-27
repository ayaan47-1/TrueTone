// Oiliness = fraction of T-zone pixels reading as specular highlight, measured RELATIVE to the
// person's own skin baseline. The old absolute luma threshold (0.8) returned 0 on any
// underexposed capture regardless of actual shine (spec F3).
import type { RgbImage, Regions, SkinBaseline } from '../types';
import { specularFraction } from '../sampling';
import { norm01, CAL } from '../calibration';

export function oiliness(img: RgbImage, regions: Regions, baseline: SkinBaseline): number {
  const f = specularFraction(img, regions.tZone, baseline, CAL.oiliness.chromaDrop, CAL.oiliness.lift);
  return norm01(f, CAL.oiliness.lo, CAL.oiliness.hi);
}
