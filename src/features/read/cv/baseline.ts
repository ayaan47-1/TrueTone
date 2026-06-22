// The fairness keystone: a robust per-person skin baseline in CIELAB, sampled from both
// cheeks. Every tone-dependent dimension subtracts this so skin tone cancels out.
import type { RgbImage, Regions, SkinBaseline } from './types';
import { srgbToLab } from './color';
import { clampRect, rgbAt, median } from './sampling';

export function sampleBaseline(img: RgbImage, regions: Regions): SkinBaseline {
  const Ls: number[] = [];
  const as: number[] = [];
  const bs: number[] = [];
  for (const rect of [regions.cheekL, regions.cheekR]) {
    const r = clampRect(rect, img.width, img.height);
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const [rr, gg, bb] = rgbAt(img, x, y);
        const lab = srgbToLab(rr, gg, bb);
        Ls.push(lab.L);
        as.push(lab.a);
        bs.push(lab.b);
      }
    }
  }
  return { L: median(Ls), a: median(as), b: median(bs) };
}
