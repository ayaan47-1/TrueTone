// Fine lines = tone-relative oriented (horizontal) gradient energy around the eyes.
import type { RgbImage, Regions } from '../types';
import { relativeGradientEnergy } from '../sampling';
import { norm01, CAL } from '../calibration';

export function fineLines(img: RgbImage, regions: Regions): number {
  const e = (relativeGradientEnergy(img, regions.periocularL) + relativeGradientEnergy(img, regions.periocularR)) / 2;
  return norm01(e, CAL.fineLines.lo, CAL.fineLines.hi);
}
