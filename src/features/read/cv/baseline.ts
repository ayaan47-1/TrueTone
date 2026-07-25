// The fairness keystone: a robust per-person skin baseline, sampled from both cheeks. Every
// tone-dependent dimension subtracts/ratios against this so skin tone cancels out.
//
// Carries both the CIELAB baseline (L/a/b — darkCircles and oiliness still use these) and the
// LINEAR baseline (Y, logRG — Task 12b, used by darkSpots/redness) because a uniform exposure
// gain scales the linear quantities exactly, but not their CIELAB counterparts (see cv/color.ts).
import type { RgbImage, Regions, SkinBaseline } from './types';
import { srgbToLab, relativeLuminance, logChromaRG } from './color';
import { clampRect, rgbAt, median } from './sampling';

export function sampleBaseline(img: RgbImage, regions: Regions): SkinBaseline {
  const Ls: number[] = [];
  const as: number[] = [];
  const bs: number[] = [];
  const Ys: number[] = [];
  const rgs: number[] = [];
  for (const rect of [regions.cheekL, regions.cheekR]) {
    const r = clampRect(rect, img.width, img.height);
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const [rr, gg, bb] = rgbAt(img, x, y);
        const lab = srgbToLab(rr, gg, bb);
        Ls.push(lab.L);
        as.push(lab.a);
        bs.push(lab.b);
        Ys.push(relativeLuminance(rr, gg, bb));
        rgs.push(logChromaRG(rr, gg, bb));
      }
    }
  }
  return { L: median(Ls), a: median(as), b: median(bs), Y: median(Ys), logRG: median(rgs) };
}
