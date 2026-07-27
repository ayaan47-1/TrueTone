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

// Dark spots are spatially extended appearance changes, unlike pore/roughness texture. Average
// linear luminance over an 11×11 neighbourhood before thresholding so pixel-scale variation cannot
// masquerade as a spot. Keep the window inside the sampled skin region to avoid background bleed.
const SPOT_RADIUS = 5;

function darkFraction(img: RgbImage, rect: Rect, baselineY: number): number {
  if (baselineY <= 0) return 0;
  const r = clampRect(rect, img.width, img.height);
  const stride = r.w + 1;
  const integral = new Float64Array((r.w + 1) * (r.h + 1));

  for (let yy = 0; yy < r.h; yy++) {
    let rowSum = 0;
    for (let xx = 0; xx < r.w; xx++) {
      const [rr, gg, bb] = rgbAt(img, r.x + xx, r.y + yy);
      rowSum += relativeLuminance(rr, gg, bb);
      integral[(yy + 1) * stride + xx + 1] = integral[yy * stride + xx + 1] + rowSum;
    }
  }

  let dark = 0;
  let n = 0;
  for (let yy = 0; yy < r.h; yy++) {
    for (let xx = 0; xx < r.w; xx++) {
      const x0 = Math.max(0, xx - SPOT_RADIUS);
      const y0 = Math.max(0, yy - SPOT_RADIUS);
      const x1 = Math.min(r.w, xx + SPOT_RADIUS + 1);
      const y1 = Math.min(r.h, yy + SPOT_RADIUS + 1);
      const sum =
        integral[y1 * stride + x1] - integral[y0 * stride + x1]
        - integral[y1 * stride + x0] + integral[y0 * stride + x0];
      const localY = sum / ((x1 - x0) * (y1 - y0));
      if (1 - localY / baselineY > CAL.darkSpots.relThr) dark++;
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
