// Pores = density of small local-contrast features in the T-zone. Coarse v1 proxy (spec §10).
import type { RgbImage, Regions } from '../types';
import { localContrastDensity } from '../sampling';
import { norm01, CAL } from '../calibration';

export function pores(img: RgbImage, regions: Regions): number {
  const density = localContrastDensity(img, regions.tZone, CAL.pores.thr);
  return norm01(density, CAL.pores.lo, CAL.pores.hi);
}
