// Fine lines = oriented (horizontal) gradient energy around the eyes.
import type { RgbImage, Regions } from '../types';
import { gradientEnergy } from '../sampling';
import { norm01, CAL } from '../calibration';

export function fineLines(img: RgbImage, regions: Regions): number {
  const e = (gradientEnergy(img, regions.periocularL) + gradientEnergy(img, regions.periocularR)) / 2;
  return norm01(e, CAL.fineLines.lo, CAL.fineLines.hi);
}
