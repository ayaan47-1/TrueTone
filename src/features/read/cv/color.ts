// sRGB (0..255) → CIELAB (D65). L* lightness, a* green↔red, b* blue↔yellow.
// a* is the redness axis; L* drives dark-circle/dark-spot deltas. Pure + standard.
import type { Lab } from './types';

const linear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

export function srgbToLab(r: number, g: number, b: number): Lab {
  const R = linear(r);
  const G = linear(g);
  const B = linear(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
