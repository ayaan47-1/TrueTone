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

// Local bbox/centroid helpers for the placement-sensitivity assertions below — mirrors the
// production box() function's min/max logic, kept separate so the test doesn't depend on an
// unexported production helper.
const boxOf = (poly: { x: number; y: number }[]) => {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};
const centroid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

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

  it('keeps periocular from overlapping infraorbital vertically (both fed to different dimensions)', () => {
    const r = regionsFromContours(contoursFor(), SIZE)!;
    expect(r.periocularL.y + r.periocularL.h).toBeLessThanOrEqual(r.infraorbitalL.y + 1);
    expect(r.periocularR.y + r.periocularR.h).toBeLessThanOrEqual(r.infraorbitalR.y + 1);
  });

  // tZone and forehead share a top strip BY DESIGN (a T-zone conventionally includes the
  // forehead), unlike the periocular/infraorbital overlap above, which was a bug. Pin the
  // intended overlap explicitly so a future reader can't confuse the two: this test documents
  // and bounds it (tZone's x-range nested inside forehead's, over their shared top band), rather
  // than leaving undocumented shared pixels indistinguishable from a defect.
  it('tZone intentionally overlaps the top of the forehead, nested inside it there', () => {
    const r = regionsFromContours(contoursFor(), SIZE)!;
    const overlapTop = Math.max(r.tZone.y, r.forehead.y);
    const overlapBottom = Math.min(r.tZone.y + r.tZone.h, r.forehead.y + r.forehead.h);
    expect(overlapBottom).toBeGreaterThan(overlapTop); // there IS a shared band, by design
    expect(r.tZone.x).toBeGreaterThanOrEqual(r.forehead.x - 1);
    expect(r.tZone.x + r.tZone.w).toBeLessThanOrEqual(r.forehead.x + r.forehead.w + 1);
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

// Every prior assertion in this file checks Y-orderings or width/height comparisons, none of
// which are sensitive to an X shift. A mirrored L/R landmark mixup, or an off-by-one contour
// index, could move a region sideways by a large amount and still pass all of them. These
// centroid-based checks are X- AND Y-sensitive for every region, tight enough that a 20%-of-
// face-width shift (~35px at this fixture's scale) fails — verified by temporarily injecting
// exactly that shift into forehead/periocularL/infraorbitalL and confirming the relevant
// assertions below failed, before removing the injection (see task-10-report.md fix round).
describe('regionsFromContours - placement is X- and Y-sensitive per region', () => {
  const TOL = 8; // px — well under a 20% face-width shift (~35px here)

  it('cheeks are centred on their own cheek contour (symmetric inset preserves the centroid)', () => {
    const c = contoursFor();
    const r = regionsFromContours(c, SIZE)!;
    const cl = centroid(boxOf(c.LEFT_CHEEK!));
    const cr = centroid(boxOf(c.RIGHT_CHEEK!));
    expect(Math.abs(centroid(r.cheekL).x - cl.x)).toBeLessThan(TOL);
    expect(Math.abs(centroid(r.cheekL).y - cl.y)).toBeLessThan(TOL);
    expect(Math.abs(centroid(r.cheekR).x - cr.x)).toBeLessThan(TOL);
    expect(Math.abs(centroid(r.cheekR).y - cr.y)).toBeLessThan(TOL);
  });

  it('forehead is centred on the face horizontal midline, above the eyebrows', () => {
    const c = contoursFor();
    const r = regionsFromContours(c, SIZE)!;
    const faceMid = centroid(boxOf(c.FACE!)).x;
    const browTop = Math.min(boxOf(c.LEFT_EYEBROW_TOP!).y, boxOf(c.RIGHT_EYEBROW_TOP!).y);
    expect(Math.abs(centroid(r.forehead).x - faceMid)).toBeLessThan(TOL);
    expect(centroid(r.forehead).y).toBeLessThan(browTop);
  });

  it('tZone is centred on the nose bridge, spanning down to the nose', () => {
    const c = contoursFor();
    const r = regionsFromContours(c, SIZE)!;
    const bridgeMid = centroid(boxOf(c.NOSE_BRIDGE!)).x;
    const noseBBox = boxOf(c.NOSE_BOTTOM!);
    expect(Math.abs(centroid(r.tZone).x - bridgeMid)).toBeLessThan(TOL);
    expect(centroid(r.tZone).y).toBeLessThan(noseBBox.y + noseBBox.h);
  });

  it('infraorbital bands sit directly under their own eye (same X centroid), below it', () => {
    const c = contoursFor();
    const r = regionsFromContours(c, SIZE)!;
    const eyeL = boxOf(c.LEFT_EYE!);
    const eyeR = boxOf(c.RIGHT_EYE!);
    expect(Math.abs(centroid(r.infraorbitalL).x - centroid(eyeL).x)).toBeLessThan(TOL);
    expect(Math.abs(centroid(r.infraorbitalR).x - centroid(eyeR).x)).toBeLessThan(TOL);
    expect(centroid(r.infraorbitalL).y).toBeGreaterThan(centroid(eyeL).y);
    expect(centroid(r.infraorbitalR).y).toBeGreaterThan(centroid(eyeR).y);
  });

  it('periocular bands sit laterally offset from their own eye by a bounded amount', () => {
    const c = contoursFor();
    const r = regionsFromContours(c, SIZE)!;
    const eyeL = boxOf(c.LEFT_EYE!);
    const eyeR = boxOf(c.RIGHT_EYE!);
    const eyeLc = centroid(eyeL);
    const eyeRc = centroid(eyeR);
    const pcL = centroid(r.periocularL);
    const pcR = centroid(r.periocularR);
    // Lateral (outward) offset from the eye's own centroid — bounded to a fraction of eye width,
    // large enough to sit outside the eye, small enough that a face-width-scale shift is caught.
    expect(eyeLc.x - pcL.x).toBeGreaterThan(0.2 * eyeL.w);
    expect(eyeLc.x - pcL.x).toBeLessThan(1.2 * eyeL.w);
    expect(pcR.x - eyeRc.x).toBeGreaterThan(0.2 * eyeR.w);
    expect(pcR.x - eyeRc.x).toBeLessThan(1.2 * eyeR.w);
    expect(Math.abs(pcL.y - eyeLc.y)).toBeLessThan(eyeL.h);
    expect(Math.abs(pcR.y - eyeRc.y)).toBeLessThan(eyeR.h);
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

  // Regression pin: fitRectXToPolygon fits a rect in sub-pixel space, but clampRect used to round
  // x/y/w/h to integers independently (Math.round on each), which can round an edge outward by up
  // to 0.5px and push a corner that legitimately passed containment back outside the polygon —
  // silently dropping a valid contour-based face to the coarser 'bounds' rung. Sweep a grid of
  // scales and offsets (the same shape the reviewer used: 9 scales x 6 dx x 6 dy = 324 combos) and
  // assert every one stays on the 'contours' rung. Before the inward-rounding fix this failed 16/324
  // times (4.9%), always on forehead; see task-10-report.md fix-round-2 for the measurement.
  it('never spuriously drops from contours to bounds due to rounding, across a scale/offset sweep', () => {
    const scales = Array.from({ length: 9 }, (_, i) => 0.5 + (i * (1.4 - 0.5)) / 8);
    const offsets = Array.from({ length: 6 }, (_, i) => -0.15 + (i * 0.3) / 5);
    let total = 0;
    let dropped = 0;
    for (const scale of scales) {
      for (const dx of offsets) {
        for (const dy of offsets) {
          total++;
          const contours = syntheticContours(faceEllipse(SIZE, { scale, dx, dy }));
          const out = deriveRegionsForFace({ bounds, contours }, SIZE);
          if (out.source !== 'contours') dropped++;
        }
      }
    }
    expect(total).toBe(324);
    expect(dropped).toBe(0);
  });
});
