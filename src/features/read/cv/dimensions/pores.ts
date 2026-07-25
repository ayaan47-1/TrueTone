// Pores = density of small RELATIVE local-contrast features in the T-zone. Weber-relative so the
// score does not scale with exposure or skin lightness (spec 4a).
import type { RgbImage, Regions } from '../types';
import { relativeContrastDensity } from '../sampling';
import { norm01, CAL } from '../calibration';

export function pores(img: RgbImage, regions: Regions): number {
  return norm01(relativeContrastDensity(img, regions.tZone, CAL.pores.relThr), CAL.pores.lo, CAL.pores.hi);
}
