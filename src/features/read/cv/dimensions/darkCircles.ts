// Dark circles = how much darker the infraorbital regions are than the cheek baseline (ΔL*).
import type { RgbImage, Regions, SkinBaseline } from '../types';
import { meanLab } from '../sampling';
import { norm01, CAL } from '../calibration';

export function darkCircles(img: RgbImage, regions: Regions, baseline: SkinBaseline): number {
  const infra = (meanLab(img, regions.infraorbitalL).L + meanLab(img, regions.infraorbitalR).L) / 2;
  return norm01(baseline.L - infra, CAL.darkCircles.lo, CAL.darkCircles.hi);
}
