// Dark spots = fraction of facial-skin pixels meaningfully darker than the person's own
// baseline, so tone cancels. Reported as the worst of cheeks + forehead.
//
// Task 12b: this used to threshold a RELATIVE L* deficit, (baselineL - L*) / baselineL. That was
// tone-invariant but NOT exposure-invariant — L* is roughly a cube root of linear luminance, so
// scaling every pixel's luminance by a gain k does not scale L* by k, and the measured illuminant
// spread was 0.1115 against a 0.08 bound, ~92% of it from the intensity (exposure) axis alone
// (temperature-only spread was already 0.0139). The fix stays baseline-relative but moves the
// ratio into the LINEAR domain, BEFORE CIELAB's cube-root compression: threshold on
// 1 - Y/baselineY, where Y is linear relative luminance (color.ts's relativeLuminance). Under
// Y -> kY, both Y and baselineY scale by the same k, so the ratio — and therefore the threshold
// decision — is exactly unchanged by a uniform exposure change.
import type { RgbImage, Regions, SkinBaseline, Rect } from '../types';
import { relativeLuminance } from '../color';
import { clampRect, rgbAt } from '../sampling';
import { norm01, CAL } from '../calibration';

function darkFraction(img: RgbImage, rect: Rect, baselineY: number): number {
  if (baselineY <= 0) return 0;
  const r = clampRect(rect, img.width, img.height);
  let dark = 0;
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const [rr, gg, bb] = rgbAt(img, x, y);
      if (1 - relativeLuminance(rr, gg, bb) / baselineY > CAL.darkSpots.relThr) dark++;
      n++;
    }
  }
  return n ? dark / n : 0;
}

export function darkSpots(img: RgbImage, regions: Regions, baseline: SkinBaseline): number {
  const worst = Math.max(
    darkFraction(img, regions.cheekL, baseline.Y),
    darkFraction(img, regions.cheekR, baseline.Y),
    darkFraction(img, regions.forehead, baseline.Y),
  );
  return norm01(worst, CAL.darkSpots.lo, CAL.darkSpots.hi);
}
