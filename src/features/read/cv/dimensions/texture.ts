// Texture = high-frequency (Laplacian) energy over forehead skin — rougher skin ⇒ higher.
import type { RgbImage, Regions } from '../types';
import { laplacianEnergy } from '../sampling';
import { norm01, CAL } from '../calibration';

export function texture(img: RgbImage, regions: Regions): number {
  return norm01(laplacianEnergy(img, regions.forehead), CAL.texture.lo, CAL.texture.hi);
}
