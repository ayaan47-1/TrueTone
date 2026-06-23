// Texture = tone-relative high-frequency contrast over forehead skin — rougher skin ⇒ higher.
// Uses microContrast (Laplacian ÷ local luma) so the score is invariant to skin tone (fairness).
import type { RgbImage, Regions } from '../types';
import { microContrast } from '../sampling';
import { norm01, CAL } from '../calibration';

export function texture(img: RgbImage, regions: Regions): number {
  return norm01(microContrast(img, regions.forehead), CAL.texture.lo, CAL.texture.hi);
}
