// Shared structural types for the classical-CV read. RgbImage is an RGBA buffer
// (4 bytes/pixel) as produced by the device JPEG decode; everything downstream is pure.
export interface Lab {
  L: number;
  a: number;
  b: number;
}

export interface RgbImage {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA, length === width * height * 4
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Lab (L/a/b) stays as-is: darkCircles and oiliness still consume it directly. Task 12b adds Y
// (linear relative luminance) and logRG (log linear-R/linear-G) — the LINEAR quantities darkSpots
// and redness now difference/ratio against, because L*/a* are nonlinear in luminance and so are
// not exposure-invariant (see cv/color.ts).
export interface SkinBaseline extends Lab {
  Y: number; // median linear relative luminance over both cheeks
  logRG: number; // median log(linear R / linear G) over both cheeks
}

export const REGION_NAMES = [
  'cheekL',
  'cheekR',
  'infraorbitalL',
  'infraorbitalR',
  'forehead',
  'periocularL',
  'periocularR',
  'tZone',
] as const;

export type RegionName = (typeof REGION_NAMES)[number];
export type Regions = Record<RegionName, Rect>;
