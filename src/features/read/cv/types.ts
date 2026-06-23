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

export type SkinBaseline = Lab;

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
