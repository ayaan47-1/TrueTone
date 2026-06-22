// Hydration is the softest CV signal (spec §10): a proxy from fine-scale smoothness —
// smoother forehead skin ⇒ higher apparent hydration. Inverse of micro-texture energy.
import type { RgbImage, Regions } from '../types';
import { laplacianEnergy } from '../sampling';
import { norm01, CAL } from '../calibration';

export function hydration(img: RgbImage, regions: Regions): number {
  return 1 - norm01(laplacianEnergy(img, regions.forehead), CAL.hydration.lo, CAL.hydration.hi);
}
