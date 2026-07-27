import { faceEllipse, surfaceNormal, syntheticContours } from '../geometry';

const SIZE = { width: 256, height: 256 };
const GEO = { scale: 1, dx: 0, dy: 0 };

describe('faceEllipse', () => {
  it('centers the face when there is no offset', () => {
    const e = faceEllipse(SIZE, GEO);
    expect(e.cx).toBeCloseTo(128);
    expect(e.cy).toBeCloseTo(128);
  });

  it('shifts with dx/dy and shrinks with scale', () => {
    const e = faceEllipse(SIZE, { scale: 0.5, dx: 0.1, dy: -0.1 });
    expect(e.cx).toBeGreaterThan(128);
    expect(e.cy).toBeLessThan(128);
    expect(e.rx).toBeLessThan(faceEllipse(SIZE, GEO).rx);
  });
});

describe('surfaceNormal', () => {
  it('points straight at the viewer at the face center', () => {
    const e = faceEllipse(SIZE, GEO);
    const [nx, ny, nz] = surfaceNormal(e.cx, e.cy, e);
    expect(nx).toBeCloseTo(0);
    expect(ny).toBeCloseTo(0);
    expect(nz).toBeCloseTo(1);
  });

  it('tilts outward near the edge', () => {
    const e = faceEllipse(SIZE, GEO);
    const [nx, , nz] = surfaceNormal(e.cx + e.rx * 0.9, e.cy, e);
    expect(nx).toBeGreaterThan(0.5);
    expect(nz).toBeLessThan(0.9);
  });

  it('is a unit vector everywhere inside the ellipse', () => {
    const e = faceEllipse(SIZE, GEO);
    for (const [x, y] of [[128, 128], [150, 140], [110, 160]]) {
      const n = surfaceNormal(x, y, e);
      expect(Math.hypot(...n)).toBeCloseTo(1, 5);
    }
  });
});

describe('syntheticContours', () => {
  const e = faceEllipse(SIZE, GEO);
  const c = syntheticContours(e);

  it('provides every contour face-geometry consumes', () => {
    for (const k of ['FACE', 'LEFT_CHEEK', 'RIGHT_CHEEK', 'LEFT_EYE', 'RIGHT_EYE',
                     'LEFT_EYEBROW_TOP', 'RIGHT_EYEBROW_TOP', 'NOSE_BRIDGE', 'NOSE_BOTTOM'] as const) {
      expect(c[k].length).toBeGreaterThan(2);
    }
  });

  it('keeps every feature contour inside the FACE polygon bounds', () => {
    const xs = c.FACE.map((p) => p.x);
    const ys = c.FACE.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    for (const k of ['LEFT_CHEEK', 'RIGHT_CHEEK', 'LEFT_EYE', 'RIGHT_EYE', 'NOSE_BRIDGE'] as const) {
      for (const p of c[k]) {
        expect(p.x).toBeGreaterThanOrEqual(x0);
        expect(p.x).toBeLessThanOrEqual(x1);
        expect(p.y).toBeGreaterThanOrEqual(y0);
        expect(p.y).toBeLessThanOrEqual(y1);
      }
    }
  });

  it('places the left contours left of the right ones', () => {
    const meanX = (ps: { x: number }[]) => ps.reduce((s, p) => s + p.x, 0) / ps.length;
    expect(meanX(c.LEFT_CHEEK)).toBeLessThan(meanX(c.RIGHT_CHEEK));
    expect(meanX(c.LEFT_EYE)).toBeLessThan(meanX(c.RIGHT_EYE));
  });

  it('places eyes above cheeks and the nose between them', () => {
    const meanY = (ps: { y: number }[]) => ps.reduce((s, p) => s + p.y, 0) / ps.length;
    expect(meanY(c.LEFT_EYE)).toBeLessThan(meanY(c.LEFT_CHEEK));
    expect(meanY(c.NOSE_BRIDGE)).toBeLessThan(meanY(c.NOSE_BOTTOM));
  });
});
