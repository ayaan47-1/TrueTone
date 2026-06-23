// Pure pixel/region readers over an RGBA RgbImage. All region functions clamp to bounds.
import type { RgbImage, Rect, Lab } from './types';
import { srgbToLab } from './color';

export function clampRect(r: Rect, w: number, h: number): Rect {
  const x = Math.max(0, Math.min(Math.round(r.x), w - 1));
  const y = Math.max(0, Math.min(Math.round(r.y), h - 1));
  const rw = Math.max(1, Math.min(Math.round(r.w), w - x));
  const rh = Math.max(1, Math.min(Math.round(r.h), h - y));
  return { x, y, w: rw, h: rh };
}

export function rgbAt(img: RgbImage, x: number, y: number): [number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

export function lumaAt(img: RgbImage, x: number, y: number): number {
  const i = (y * img.width + x) * 4;
  return (0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]) / 255;
}

export function meanLab(img: RgbImage, rect: Rect): Lab {
  const r = clampRect(rect, img.width, img.height);
  let L = 0;
  let a = 0;
  let b = 0;
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const [rr, gg, bb] = rgbAt(img, x, y);
      const lab = srgbToLab(rr, gg, bb);
      L += lab.L;
      a += lab.a;
      b += lab.b;
      n++;
    }
  }
  return { L: L / n, a: a / n, b: b / n };
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function laplacianEnergy(img: RgbImage, rect: Rect): number {
  const r = clampRect(rect, img.width, img.height);
  let sum = 0;
  let n = 0;
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const lap =
        4 * lumaAt(img, x, y) -
        lumaAt(img, x - 1, y) -
        lumaAt(img, x + 1, y) -
        lumaAt(img, x, y - 1) -
        lumaAt(img, x, y + 1);
      sum += Math.abs(lap);
      n++;
    }
  }
  return n ? sum / n : 0;
}

export function meanLuma(img: RgbImage, rect: Rect): number {
  const r = clampRect(rect, img.width, img.height);
  let sum = 0;
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      sum += lumaAt(img, x, y);
      n++;
    }
  }
  return n ? sum / n : 0;
}

// Weber-style relative texture: high-frequency energy divided by local brightness, so the
// measure is invariant to overall skin lightness. This is the fairness fix — absolute Laplacian
// energy scales with luminance, biasing texture/hydration across Fitzpatrick tones.
export function microContrast(img: RgbImage, rect: Rect): number {
  const lum = meanLuma(img, rect);
  return lum > 0 ? laplacianEnergy(img, rect) / lum : 0;
}

export function gradientEnergy(img: RgbImage, rect: Rect): number {
  const r = clampRect(rect, img.width, img.height);
  let sum = 0;
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x + 1; x < r.x + r.w; x++) {
      sum += Math.abs(lumaAt(img, x, y) - lumaAt(img, x - 1, y));
      n++;
    }
  }
  return n ? sum / n : 0;
}

export function localContrastDensity(img: RgbImage, rect: Rect, thr: number): number {
  const r = clampRect(rect, img.width, img.height);
  let count = 0;
  let n = 0;
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const localMean =
        (lumaAt(img, x - 1, y) + lumaAt(img, x + 1, y) + lumaAt(img, x, y - 1) + lumaAt(img, x, y + 1)) / 4;
      if (Math.abs(lumaAt(img, x, y) - localMean) > thr) count++;
      n++;
    }
  }
  return n ? count / n : 0;
}
