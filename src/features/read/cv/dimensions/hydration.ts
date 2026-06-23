// Hydration is the softest CV signal (spec §10): a proxy from fine-scale smoothness —
// smoother forehead skin ⇒ higher apparent hydration. Inverse of tone-relative micro-texture
// (microContrast = Laplacian ÷ local luma), so the score is invariant to skin tone (fairness).
import type { RgbImage, Regions } from '../types';
import { microContrast } from '../sampling';
import { norm01, CAL } from '../calibration';

export function hydration(img: RgbImage, regions: Regions): number {
  return 1 - norm01(microContrast(img, regions.forehead), CAL.hydration.lo, CAL.hydration.hi);
}
