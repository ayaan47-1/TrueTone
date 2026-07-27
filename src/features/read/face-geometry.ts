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

// Reuses the exact sanity bounds specified for still detection in the design spec (§7 Error
// handling): aspect in [0.6, 1.6], area fraction in [0.05, 0.95], bounds within the frame (with a
// little slop for rounding). A detection that fails this check is treated the same as no
// detection — deriveRegionsForFace's existing fallback chain takes over — rather than trusted and
// silently mis-scaled. This is what makes both the source/working coordinate-space mismatch (task
// 16) AND an unverified EXIF-orientation mismatch degrade safely instead of producing a
// wrong-but-plausible-looking read.
const MIN_ASPECT = 0.6;
const MAX_ASPECT = 1.6;
const MIN_AREA_FRACTION = 0.05;
const MAX_AREA_FRACTION = 0.95;
const BOUNDS_SLOP_FRACTION = 0.02;

export function isPlausibleFaceDetection(
  bounds: Rect,
  sourceSize: { width: number; height: number },
): boolean {
  if (sourceSize.width <= 0 || sourceSize.height <= 0) return false;
  if (bounds.w <= 0 || bounds.h <= 0) return false;
  const slopX = sourceSize.width * BOUNDS_SLOP_FRACTION;
  const slopY = sourceSize.height * BOUNDS_SLOP_FRACTION;
  if (bounds.x < -slopX || bounds.y < -slopY) return false;
  if (bounds.x + bounds.w > sourceSize.width + slopX) return false;
  if (bounds.y + bounds.h > sourceSize.height + slopY) return false;
  const aspect = bounds.w / bounds.h;
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) return false;
  const areaFraction = (bounds.w * bounds.h) / (sourceSize.width * sourceSize.height);
  return areaFraction >= MIN_AREA_FRACTION && areaFraction <= MAX_AREA_FRACTION;
}

function scaleContours(
  c: Partial<FaceContours>,
  from: { width: number; height: number },
  to: { width: number; height: number },
): Partial<FaceContours> {
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const out: Partial<FaceContours> = {};
  for (const key of Object.keys(c) as Array<keyof FaceContours>) {
    const pts = c[key];
    if (pts) out[key] = pts.map((p) => ({ x: p.x * sx, y: p.y * sy }));
  }
  return out;
}

// Transforms a face detected in SOURCE (full-resolution) pixel space into WORKING-image pixel
// space, and rejects a detection that doesn't plausibly fit the frame it claims to describe.
// Returns null (never throws) on any implausible input — callers must treat null exactly like "no
// face detected" and fall through to deriveRegionsForFace's proportional/approximate fallback.
export function scaleFaceToWorkingSpace(
  face: DetectedFace | null,
  sourceSize: { width: number; height: number },
  workingSize: { width: number; height: number },
): DetectedFace | null {
  if (!face) return null;
  const bounds: Rect = {
    x: face.bounds.x, y: face.bounds.y, w: face.bounds.width, h: face.bounds.height,
  };
  if (!isPlausibleFaceDetection(bounds, sourceSize)) return null;
  const scaled = scaleRect(bounds, sourceSize, workingSize);
  return {
    bounds: { x: scaled.x, y: scaled.y, width: scaled.w, height: scaled.h },
    contours: face.contours ? scaleContours(face.contours, sourceSize, workingSize) : undefined,
  };
}

function centroidOf(pts: Point[]): Point {
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / pts.length, y: sy / pts.length };
}

// Accepts any non-empty run of points. A 1-point contour yields a zero-area box and a 2-point one
// a line — both legitimate for the callers below, which use them for POSITION, not extent.
function box(pts: Point[] | undefined): Rect | null {
  if (!pts || pts.length < 1) return null;
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

// Minimum points per contour, set from what MLKit ACTUALLY returns (read off a Fold 7,
// 2026-07-26): FACE:36 LEFT_EYE:16 RIGHT_EYE:16 *_EYEBROW_TOP:5 NOSE_BOTTOM:3 NOSE_BRIDGE:2
// LEFT_CHEEK:1 RIGHT_CHEEK:1.
//
// A flat "3 or more" was rejecting three of the nine required contours on every real capture,
// because a cheek is a single POINT and the bridge is a two-point LINE. The synthetic fixture in
// eval/render/geometry.ts builds cheeks as 12-point ellipses and the bridge as an 8-point one, so
// nothing off-device could have caught it — contour derivation had never run against a real face.
const MIN_POINTS: Record<string, number> = {
  FACE: 3,
  LEFT_EYE: 3,
  RIGHT_EYE: 3,
  LEFT_EYEBROW_TOP: 3,
  RIGHT_EYEBROW_TOP: 3,
  NOSE_BOTTOM: 3,
  NOSE_BRIDGE: 2, // a line down the midline; used for its x, never its width
  LEFT_CHEEK: 1, // a single point at the cheek centre
  RIGHT_CHEEK: 1,
};

const REQUIRED = Object.keys(MIN_POINTS) as Array<keyof FaceContours>;

// A cheek arrives as one point, so its patch has to be sized from something else. The face box is
// the only stable reference to hand, and these fractions keep the patch clear of the nose medially
// and the jawline below at a neutral pose; anything tighter stops being a representative sample of
// cheek skin, anything wider starts catching the nasolabial fold. fitRectXToPolygon still shrinks
// it against the real FACE outline afterwards, so a turned head narrows it rather than spilling.
const CHEEK_WIDTH_FRACTION_OF_FACE = 0.18;
const CHEEK_HEIGHT_FRACTION_OF_FACE = 0.12;

// tZone's width used to come from the nose bridge's bounding box, which for a two-point line is
// ~0. NOSE_BOTTOM spans the base of the nose, so it is both non-degenerate and the anatomically
// right scale for a T-zone stem.
const TZONE_WIDTH_FROM_NOSE_BASE = 1.1;

/**
 * Why a set of contours could not produce regions. `null` means they could.
 *
 * Exists because "no usable contours" was one word covering six unrelated rejections, and the
 * device pass on 2026-07-26 hit one of them with all nine required contours PRESENT — MLKit
 * returned 15 of them and derivation still failed, with nothing on screen to say which check
 * rejected it. Shapes: `missing-contour:<KEY>`, `does-not-fit:<region>`,
 * `degenerate-after-round:<region>`, `degenerate-after-clamp:<region>`, `outside-polygon:<region>`.
 */
export function contourRejectionReason(
  c: Partial<FaceContours>,
  size: { width: number; height: number },
): string | null {
  return deriveFromContours(c, size).reason;
}

export function regionsFromContours(
  c: Partial<FaceContours>,
  size: { width: number; height: number },
): Regions | null {
  return deriveFromContours(c, size).regions;
}

function deriveFromContours(
  c: Partial<FaceContours>,
  size: { width: number; height: number },
): { regions: Regions | null; reason: string | null } {
  const reject = (reason: string) => ({ regions: null, reason });
  for (const k of REQUIRED) {
    if (!c[k] || c[k]!.length < MIN_POINTS[k]) return reject(`missing-contour:${k}`);
  }

  const face = box(c.FACE)!;
  const eyeL = box(c.LEFT_EYE)!;
  const eyeR = box(c.RIGHT_EYE)!;
  const browL = box(c.LEFT_EYEBROW_TOP)!;
  const browR = box(c.RIGHT_EYEBROW_TOP)!;
  // Cheeks are POINTS, so take a centroid (identical to the point itself when there is only one,
  // and still correct for the multi-point synthetic fixture) and build a patch around it.
  const cheekL = centroidOf(c.LEFT_CHEEK!);
  const cheekR = centroidOf(c.RIGHT_CHEEK!);
  const bridge = box(c.NOSE_BRIDGE)!;
  const noseB = box(c.NOSE_BOTTOM)!;

  const cheekW = face.w * CHEEK_WIDTH_FRACTION_OF_FACE;
  const cheekH = face.h * CHEEK_HEIGHT_FRACTION_OF_FACE;
  const cheekRect = (pt: Point): Rect => ({
    x: pt.x - cheekW / 2,
    y: pt.y - cheekH / 2,
    w: cheekW,
    h: cheekH,
  });

  const browTop = Math.min(browL.y, browR.y);
  const foreheadTop = face.y + face.h * 0.06;

  const raw: Record<RegionName, Rect> = {
    cheekL: cheekRect(cheekL),
    cheekR: cheekRect(cheekR),
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
    // Centred on the bridge's midline (its x is meaningful even as a 2-point line), but WIDTH from
    // the nose base — the bridge's own bbox width is ~0 on real contours.
    tZone: {
      x: bridge.x + bridge.w / 2 - (noseB.w * TZONE_WIDTH_FROM_NOSE_BASE) / 2,
      y: foreheadTop,
      w: noseB.w * TZONE_WIDTH_FROM_NOSE_BASE,
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
    if (!f) return reject(`does-not-fit:${n}`);
    // Round inward here, before clampRect, so clampRect's independent Math.round on x/y/w/h
    // (which can round an edge outward) never gets a chance to expand a rect past the polygon
    // it was just fitted to.
    const rounded = roundRectInward(f);
    if (rounded.w < 2 || rounded.h < 2) return reject(`degenerate-after-round:${n}`);
    fitted[n] = rounded;
  }

  const out = Object.fromEntries(
    REGION_NAMES.map((n) => [n, clampRect(fitted[n]!, size.width, size.height)]),
  ) as Regions;

  // Validity: every region must be non-degenerate and have all four corners inside the real FACE
  // polygon — not just its bounding box, which a narrowing hairline makes an unsafe stand-in.
  for (const n of REGION_NAMES) {
    const r = out[n];
    if (r.w < 2 || r.h < 2) return reject(`degenerate-after-clamp:${n}`);
    if (!rectCornersInPolygon(r, facePoly)) return reject(`outside-polygon:${n}`);
  }
  return { regions: out, reason: null };
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
