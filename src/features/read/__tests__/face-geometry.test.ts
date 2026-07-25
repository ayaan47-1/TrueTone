import { scaleRect, regionsFromContours, deriveRegionsForFace, rectCornersInPolygon } from '../face-geometry';
import { faceEllipse, syntheticContours } from '../../../../eval/render/geometry';
import { REGION_NAMES } from '../cv/types';

const SIZE = { width: 256, height: 256 };
const contoursFor = (g = { scale: 1, dx: 0, dy: 0 }) => syntheticContours(faceEllipse(SIZE, g));
// Real point-in-polygon containment (all four corners), not a bounding-box approximation — a
// face narrows toward the hairline, so the bbox is not a safe stand-in for the polygon. Reuses
// the exact same implementation the production validity guard uses, so the test can't drift from
// what the code actually checks.
const inside = (r: any, poly: any[]) => rectCornersInPolygon(r, poly);

describe('scaleRect', () => {
  it('is identity when the sizes match', () => {
    const r = { x: 10, y: 20, w: 30, h: 40 };
    expect(scaleRect(r, SIZE, SIZE)).toEqual(r);
  });
  it('scales proportionally when the working image is smaller', () => {
    const out = scaleRect({ x: 100, y: 200, w: 400, h: 400 }, { width: 1000, height: 1000 }, { width: 100, height: 100 });
    expect(out).toEqual({ x: 10, y: 20, w: 40, h: 40 });
  });
});

describe('regionsFromContours', () => {
  it('produces every named region', () => {
    const r = regionsFromContours(contoursFor(), SIZE)!;
    for (const n of REGION_NAMES) expect(r[n].w).toBeGreaterThan(0);
  });

  it('keeps every region inside the FACE polygon', () => {
    const c = contoursFor();
    const r = regionsFromContours(c, SIZE)!;
    for (const n of REGION_NAMES) expect(inside(r[n], c.FACE)).toBe(true);
  });

  it('places cheeks on the cheek contours, left of and right of centre', () => {
    const r = regionsFromContours(contoursFor(), SIZE)!;
    expect(r.cheekL.x + r.cheekL.w / 2).toBeLessThan(128);
    expect(r.cheekR.x + r.cheekR.w / 2).toBeGreaterThan(128);
  });

  it('places the forehead above the eyes', () => {
    const r = regionsFromContours(contoursFor(), SIZE)!;
    expect(r.forehead.y + r.forehead.h).toBeLessThanOrEqual(r.periocularL.y + r.periocularL.h);
  });

  it('places infraorbital bands below the eyes and above the cheeks', () => {
    const r = regionsFromContours(contoursFor(), SIZE)!;
    expect(r.infraorbitalL.y).toBeGreaterThan(r.periocularL.y);
    expect(r.infraorbitalL.y).toBeLessThan(r.cheekL.y);
  });

  it('keeps the tZone from overlapping either cheek horizontally', () => {
    const r = regionsFromContours(contoursFor(), SIZE)!;
    expect(r.tZone.x).toBeGreaterThanOrEqual(r.cheekL.x + r.cheekL.w - 1);
    expect(r.tZone.x + r.tZone.w).toBeLessThanOrEqual(r.cheekR.x + 1);
  });

  it('tracks a shifted, smaller face', () => {
    const wide = regionsFromContours(contoursFor(), SIZE)!;
    const small = regionsFromContours(contoursFor({ scale: 0.6, dx: 0.1, dy: 0 }), SIZE)!;
    expect(small.cheekL.w).toBeLessThan(wide.cheekL.w);
    expect(small.cheekL.x).toBeGreaterThan(wide.cheekL.x);
  });

  it('returns null when a required contour is missing', () => {
    const { LEFT_CHEEK, ...rest } = contoursFor();
    expect(regionsFromContours(rest as any, SIZE)).toBeNull();
  });
});

describe('deriveRegionsForFace', () => {
  const bounds = { x: 40, y: 30, width: 170, height: 210 };

  it('uses contours when they are present and valid', () => {
    expect(deriveRegionsForFace({ bounds, contours: contoursFor() }, SIZE).source).toBe('contours');
  });

  it('falls back to proportional regions off the bounds when contours are absent', () => {
    expect(deriveRegionsForFace({ bounds }, SIZE).source).toBe('bounds');
  });

  it('falls back again to the centered approximation when no face was detected', () => {
    const out = deriveRegionsForFace(null, SIZE);
    expect(out.source).toBe('fallback');
    for (const n of REGION_NAMES) expect(out.regions[n].w).toBeGreaterThan(0);
  });

  it('never returns a region outside the image at any fallback level', () => {
    for (const face of [{ bounds, contours: contoursFor() }, { bounds }, null]) {
      const { regions } = deriveRegionsForFace(face, SIZE);
      for (const n of REGION_NAMES) {
        expect(regions[n].x).toBeGreaterThanOrEqual(0);
        expect(regions[n].y).toBeGreaterThanOrEqual(0);
        expect(regions[n].x + regions[n].w).toBeLessThanOrEqual(SIZE.width);
        expect(regions[n].y + regions[n].h).toBeLessThanOrEqual(SIZE.height);
      }
    }
  });
});
