// Dark spots = fraction of facial-skin pixels meaningfully darker than the person's own
// baseline L* (so tone cancels). The threshold is RELATIVE — a fraction of baseline L* — because
// a fixed absolute ΔL* biases across tones (CIELAB L* is nonlinear). Reported as the worst of
// cheeks + forehead.
import type { RgbImage, Regions, SkinBaseline, Rect } from '../types';
import { srgbToLab } from '../color';
import { clampRect, rgbAt } from '../sampling';
import { norm01, CAL } from '../calibration';

function darkFraction(img: RgbImage, rect: Rect, baselineL: number): number {
  if (baselineL <= 0) return 0;
  const r = clampRect(rect, img.width, img.height);
  let dark = 0;
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const [rr, gg, bb] = rgbAt(img, x, y);
      if ((baselineL - srgbToLab(rr, gg, bb).L) / baselineL > CAL.darkSpots.relThr) dark++;
      n++;
    }
  }
  return n ? dark / n : 0;
}

export function darkSpots(img: RgbImage, regions: Regions, baseline: SkinBaseline): number {
  const worst = Math.max(
    darkFraction(img, regions.cheekL, baseline.L),
    darkFraction(img, regions.cheekR, baseline.L),
    darkFraction(img, regions.forehead, baseline.L),
  );
  return norm01(worst, CAL.darkSpots.lo, CAL.darkSpots.hi);
}
