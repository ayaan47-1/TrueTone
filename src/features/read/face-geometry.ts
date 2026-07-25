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
    // Outer margin of each eye — where crow's feet sit.
    periocularL: { x: eyeL.x - eyeL.w * 0.5, y: eyeL.y - eyeL.h * 0.6, w: eyeL.w * 0.75, h: eyeL.h * 2.4 },
    periocularR: { x: eyeR.x + eyeR.w * 0.75, y: eyeR.y - eyeR.h * 0.6, w: eyeR.w * 0.75, h: eyeR.h * 2.4 },
    // Nose bridge through nose bottom, widened — plus the forehead strip above it.
    tZone: {
      x: bridge.x - bridge.w * 0.6,
      y: foreheadTop,
      w: bridge.w * 2.2,
      h: (noseB.y + noseB.h) - foreheadTop,
    },
  };

  const out = Object.fromEntries(
    REGION_NAMES.map((n) => [n, clampRect(raw[n], size.width, size.height)]),
  ) as Regions;

  // Validity: every region must be non-degenerate and sit inside the FACE polygon's bounds.
  for (const n of REGION_NAMES) {
    const r = out[n];
    if (r.w < 2 || r.h < 2) return null;
    if (r.x < face.x - 1 || r.y < face.y - 1) return null;
    if (r.x + r.w > face.x + face.w + 1 || r.y + r.h > face.y + face.h + 1) return null;
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
