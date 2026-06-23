// Deterministic synthetic RgbImage builders for unit tests and the fairness self-test.
// All builders return a NEW image (immutability rule). Bounds are clamped inline so this
// module depends only on types (no import cycle with sampling).
import type { RgbImage, Rect } from './types';

type Rgb = [number, number, number];

function clone(img: RgbImage): RgbImage {
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

function bounds(img: RgbImage, r: Rect) {
  const x0 = Math.max(0, Math.floor(r.x));
  const y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(img.width, Math.floor(r.x + r.w));
  const y1 = Math.min(img.height, Math.floor(r.y + r.h));
  return { x0, y0, x1, y1 };
}

export function solidRgb(width: number, height: number, rgb: Rgb = [180, 140, 120]): RgbImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

export function fillRect(img: RgbImage, rect: Rect, rgb: Rgb): RgbImage {
  const out = clone(img);
  const { x0, y0, x1, y1 } = bounds(img, rect);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      out.data[i] = rgb[0];
      out.data[i + 1] = rgb[1];
      out.data[i + 2] = rgb[2];
      out.data[i + 3] = 255;
    }
  }
  return out;
}

export function addNoise(img: RgbImage, rect: Rect, amp: number, seed = 1): RgbImage {
  const out = clone(img);
  const { x0, y0, x1, y1 } = bounds(img, rect);
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      const d = (rnd() * 2 - 1) * amp;
      out.data[i] = img.data[i] + d;
      out.data[i + 1] = img.data[i + 1] + d;
      out.data[i + 2] = img.data[i + 2] + d;
    }
  }
  return out;
}

export function vStripes(img: RgbImage, rect: Rect, drop: number): RgbImage {
  // Darken every other column inside the rect — a strong horizontal-gradient signal.
  const out = clone(img);
  const { x0, y0, x1, y1 } = bounds(img, rect);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (x % 2 === 0) continue;
      const i = (y * img.width + x) * 4;
      out.data[i] = img.data[i] - drop;
      out.data[i + 1] = img.data[i + 1] - drop;
      out.data[i + 2] = img.data[i + 2] - drop;
    }
  }
  return out;
}
