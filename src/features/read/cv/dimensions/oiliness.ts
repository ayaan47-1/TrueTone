// Oiliness = fraction of T-zone pixels that read as specular highlight (bright + low saturation).
import type { RgbImage, Regions } from '../types';
import { clampRect, rgbAt, lumaAt } from '../sampling';
import { norm01, CAL } from '../calibration';

export function oiliness(img: RgbImage, regions: Regions): number {
  const r = clampRect(regions.tZone, img.width, img.height);
  let hi = 0;
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const [R, G, B] = rgbAt(img, x, y);
      const mx = Math.max(R, G, B);
      const mn = Math.min(R, G, B);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      if (lumaAt(img, x, y) > CAL.oiliness.lumaThr && sat < CAL.oiliness.satThr) hi++;
      n++;
    }
  }
  return norm01(n ? hi / n : 0, CAL.oiliness.lo, CAL.oiliness.hi);
}
