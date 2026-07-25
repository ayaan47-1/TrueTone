// Contours → Regions (spec §3b). Pure: the device shell (detect-faces-still.ts) supplies the
// DetectedFace; this module never touches native.
//
// Fallback chain, each step failing open to the next:
//   contours present and valid → contour regions
//   face detected, no contours → proportional regions off the detected bounds
//   no face                    → approximateFaceBbox, i.e. exactly today's behaviour
import type { Rect, Regions, RegionName } from './cv/types';
import { REGION_NAMES } from './cv/types';
import { deriveRegions } from './cv/regions';
import { approximateFaceBbox } from './detect-bbox';
import { clampRect } from './cv/sampling';

export interface Point { x: number; y: number }
export interface FaceContours {
  FACE: Point[]; LEFT_CHEEK: Point[]; RIGHT_CHEEK: Point[];
  LEFT_EYE: Point[]; RIGHT_EYE: Point[];
  LEFT_EYEBROW_TOP: Point[]; RIGHT_EYEBROW_TOP: Point[];
  NOSE_BRIDGE: Point[]; NOSE_BOTTOM: Point[];
}
export interface DetectedFace {
  bounds: { x: number; y: number; width: number; height: number };
  contours?: Partial<FaceContours>;
}

export function scaleRect(r: Rect, from: { width: number; height: number }, to: { width: number; height: number }): Rect {
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  return { x: Math.round(r.x * sx), y: Math.round(r.y * sy), w: Math.round(r.w * sx), h: Math.round(r.h * sy) };
}

function box(pts: Point[] | undefined): Rect | null {
  if (!pts || pts.length < 3) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

const inset = (r: Rect, k: number): Rect => ({
  x: r.x + r.w * k, y: r.y + r.h * k, w: r.w * (1 - 2 * k), h: r.h * (1 - 2 * k),
});

// Standard ray-casting point-in-polygon test. A face outline narrows toward the hairline, so its
// bounding box is a poor stand-in for containment — a rect can sit inside the box and still be
// outside the actual face (sampling hair/background). This tests the real polygon.
export function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const crosses = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

// The FACE contour is convex-ish (an oval), so all four corners of a rect lying inside it is a
// sufficient condition for the whole rect lying inside it.
export function rectCornersInPolygon(r: Rect, poly: Point[]): boolean {
  const corners: Point[] = [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x, y: r.y + r.h },
    { x: r.x + r.w, y: r.y + r.h },
  ];
  return corners.every((pt) => pointInPolygon(pt, poly));
}

// Horizontal extent of `poly` at height `y`, via scanline: intersect every edge crossing y and
// take the min/max x. Returns null if y falls outside the polygon's vertical extent entirely.
function xRangeAtY(poly: Point[], y: number): { min: number; max: number } | null {
  const xs: number[] = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i].y;
    const yj = poly[j].y;
    if ((yi <= y && yj > y) || (yj <= y && yi > y)) {
      const t = (y - yi) / (yj - yi);
      xs.push(poly[i].x + t * (poly[j].x - poly[i].x));
    }
  }
  return xs.length ? { min: Math.min(...xs), max: Math.max(...xs) } : null;
}

const FIT_MARGIN_PX = 1;

// Shrinks r horizontally so all four corners sit inside `poly`. Samples the polygon's x-extent at
// several heights spanning the rect and takes the tightest (intersection) band — this is what
// makes a region that starts too wide near a narrowing hairline shrink to fit, rather than being
// waved through on a bounding-box check. Returns null if the rect's height range falls outside the
// polygon, or the fitted band would be degenerate (a region that genuinely cannot fit).
function fitRectXToPolygon(r: Rect, poly: Point[]): Rect | null {
  const samples = [r.y, r.y + r.h * 0.25, r.y + r.h * 0.5, r.y + r.h * 0.75, r.y + r.h];
  let left = -Infinity;
  let right = Infinity;
  for (const y of samples) {
    const range = xRangeAtY(poly, y);
    if (!range) return null;
    left = Math.max(left, range.min);
    right = Math.min(right, range.max);
  }
  left += FIT_MARGIN_PX;
  right -= FIT_MARGIN_PX;
  if (right - left < 2) return null;
  const x = Math.max(r.x, left);
  const w = Math.min(r.x + r.w, right) - x;
  if (w < 2) return null;
  return { ...r, x, w };
}

// Rounds a sub-pixel rect to integer coordinates WITHOUT ever growing it: left/top round up
// (Math.ceil), right/bottom round down (Math.floor), so the integer rect is always a subset of
// the float one. `clampRect` rounds x/y/w/h independently via Math.round, which can round each
// edge outward by up to 0.5px and push a corner that legitimately passed rectCornersInPolygon
// back outside the polygon after rounding — this is what fitRectXToPolygon's fitted (but still
// fractional) rect must go through before it ever reaches clampRect.
function roundRectInward(r: Rect): Rect {
  const left = Math.ceil(r.x);
  const top = Math.ceil(r.y);
  const right = Math.floor(r.x + r.w);
  const bottom = Math.floor(r.y + r.h);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

const REQUIRED: Array<keyof FaceContours> = [
  'FACE', 'LEFT_CHEEK', 'RIGHT_CHEEK', 'LEFT_EYE', 'RIGHT_EYE',
  'LEFT_EYEBROW_TOP', 'RIGHT_EYEBROW_TOP', 'NOSE_BRIDGE', 'NOSE_BOTTOM',
];

export function regionsFromContours(
  c: Partial<FaceContours>,
  size: { width: number; height: number },
): Regions | null {
  for (const k of REQUIRED) if (!c[k] || c[k]!.length < 3) return null;

  const face = box(c.FACE)!;
  const eyeL = box(c.LEFT_EYE)!;
  const eyeR = box(c.RIGHT_EYE)!;
  const browL = box(c.LEFT_EYEBROW_TOP)!;
  const browR = box(c.RIGHT_EYEBROW_TOP)!;
  const cheekL = box(c.LEFT_CHEEK)!;
  const cheekR = box(c.RIGHT_CHEEK)!;
  const bridge = box(c.NOSE_BRIDGE)!;
  const noseB = box(c.NOSE_BOTTOM)!;

  const browTop = Math.min(browL.y, browR.y);
  const foreheadTop = face.y + face.h * 0.06;

  const raw: Record<RegionName, Rect> = {
    cheekL: inset(cheekL, 0.15),
    cheekR: inset(cheekR, 0.15),
    // Between the eye and the cheek, spanning the eye's width.
    infraorbitalL: { x: eyeL.x, y: eyeL.y + eyeL.h, w: eyeL.w, h: Math.max(2, cheekL.y - (eyeL.y + eyeL.h)) },
    infraorbitalR: { x: eyeR.x, y: eyeR.y + eyeR.h, w: eyeR.w, h: Math.max(2, cheekR.y - (eyeR.y + eyeR.h)) },
    // Above the brows, clipped to the FACE polygon.
    forehead: { x: face.x + face.w * 0.22, y: foreheadTop, w: face.w * 0.56, h: Math.max(2, browTop - foreheadTop) },
    // Outer margin of each eye — where crow's feet sit. Height is capped at 1.4x the eye height
    // (vs. an eye that starts 0.6x above eye-top) so periocular's bottom edge stays at
    // eyeL.y + 0.8*eyeL.h — short of infraorbital's top at eyeL.y + 1.0*eyeL.h, leaving a
    // 0.2*eyeL.h margin. Crow's feet are lateral to the eye, so capping vertical reach costs
    // nothing anatomically; the alternative (2.4x) reached eyeL.y + 1.8*eyeL.h, deep into the
    // infraorbital band (measured: 84px^2 / 17.6% of infraorbitalL's area on the standard fixture).
    periocularL: { x: eyeL.x - eyeL.w * 0.5, y: eyeL.y - eyeL.h * 0.6, w: eyeL.w * 0.75, h: eyeL.h * 1.4 },
    periocularR: { x: eyeR.x + eyeR.w * 0.75, y: eyeR.y - eyeR.h * 0.6, w: eyeR.w * 0.75, h: eyeR.h * 1.4 },
    // Nose bridge through nose bottom, widened — plus the forehead strip above it. tZone
    // INTENTIONALLY overlaps the top of `forehead` (both start at foreheadTop, and tZone's
    // x-range sits inside forehead's there): a T-zone conventionally includes the forehead's
    // centre strip. This is the one region pair allowed to share pixels — see the pinning test
    // "tZone intentionally overlaps..." in face-geometry.test.ts, which documents and bounds it
    // so it isn't mistaken for the periocular/infraorbital overlap bug this file also guards
    // against.
    tZone: {
      x: bridge.x - bridge.w * 0.6,
      y: foreheadTop,
      w: bridge.w * 2.2,
      h: (noseB.y + noseB.h) - foreheadTop,
    },
  };

  // Fit each rect's horizontal extent to the real FACE polygon before clamping to image bounds —
  // a fixed-fraction rect (e.g. forehead, tZone) can be wider than the face is at that height
  // near the hairline, and this is what shrinks it back to something that samples only face.
  const facePoly = c.FACE as Point[];
  const fitted: Partial<Record<RegionName, Rect>> = {};
  for (const n of REGION_NAMES) {
    const f = fitRectXToPolygon(raw[n], facePoly);
    if (!f) return null;
    // Round inward here, before clampRect, so clampRect's independent Math.round on x/y/w/h
    // (which can round an edge outward) never gets a chance to expand a rect past the polygon
    // it was just fitted to.
    const rounded = roundRectInward(f);
    if (rounded.w < 2 || rounded.h < 2) return null;
    fitted[n] = rounded;
  }

  const out = Object.fromEntries(
    REGION_NAMES.map((n) => [n, clampRect(fitted[n]!, size.width, size.height)]),
  ) as Regions;

  // Validity: every region must be non-degenerate and have all four corners inside the real FACE
  // polygon — not just its bounding box, which a narrowing hairline makes an unsafe stand-in.
  for (const n of REGION_NAMES) {
    const r = out[n];
    if (r.w < 2 || r.h < 2) return null;
    if (!rectCornersInPolygon(r, facePoly)) return null;
  }
  return out;
}

export function deriveRegionsForFace(
  face: DetectedFace | null,
  size: { width: number; height: number },
): { regions: Regions; source: 'contours' | 'bounds' | 'fallback' } {
  if (face?.contours) {
    const r = regionsFromContours(face.contours, size);
    if (r) return { regions: r, source: 'contours' };
  }
  if (face) {
    const b: Rect = { x: face.bounds.x, y: face.bounds.y, w: face.bounds.width, h: face.bounds.height };
    return { regions: deriveRegions(b, size), source: 'bounds' };
  }
  return { regions: deriveRegions(approximateFaceBbox(size.width, size.height), size), source: 'fallback' };
}
