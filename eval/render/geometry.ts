// Face shape for the synthetic renderer: an ellipsoid standing in for a head, plus contour
// polygons in the SAME shape MLKit returns (spec §3b), so face-geometry.ts can be unit-tested
// against renderer output without an adapter layer.

export interface Point { x: number; y: number }
export interface Ellipse { cx: number; cy: number; rx: number; ry: number }
export interface RenderGeometry { scale: number; dx: number; dy: number }

export interface FaceContours {
  FACE: Point[];
  LEFT_CHEEK: Point[];
  RIGHT_CHEEK: Point[];
  LEFT_EYE: Point[];
  RIGHT_EYE: Point[];
  LEFT_EYEBROW_TOP: Point[];
  RIGHT_EYEBROW_TOP: Point[];
  NOSE_BRIDGE: Point[];
  NOSE_BOTTOM: Point[];
}

export function faceEllipse(
  size: { width: number; height: number },
  g: RenderGeometry,
): Ellipse {
  return {
    cx: size.width / 2 + g.dx * size.width,
    cy: size.height / 2 + g.dy * size.height,
    rx: 0.34 * size.width * g.scale,
    ry: 0.44 * size.height * g.scale,
  };
}

// Ellipsoid normal: project the pixel into the unit disc, lift z off the sphere.
export function surfaceNormal(x: number, y: number, e: Ellipse): [number, number, number] {
  const nx = (x - e.cx) / e.rx;
  const ny = (y - e.cy) / e.ry;
  const r2 = nx * nx + ny * ny;
  if (r2 >= 1) return [0, 0, 1];
  const nz = Math.sqrt(1 - r2);
  const len = Math.hypot(nx, ny, nz);
  return [nx / len, ny / len, nz / len];
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, n: number): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
  });
}

function arcPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  start: number,
  end: number,
  n: number,
): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const t = start + (i / (n - 1)) * (end - start);
    return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
  });
}

export function syntheticContours(e: Ellipse): FaceContours {
  const { cx, cy, rx, ry } = e;
  return {
    // Cardinalities mirror the MLKit still-detector payload observed on hardware. Cheeks are
    // landmarks, the bridge is a centre line, and the nose bottom is a short three-point arch.
    FACE: ellipsePoints(cx, cy, rx, ry, 36),
    LEFT_CHEEK: [{ x: cx - rx * 0.45, y: cy + ry * 0.22 }],
    RIGHT_CHEEK: [{ x: cx + rx * 0.45, y: cy + ry * 0.22 }],
    LEFT_EYE: ellipsePoints(cx - rx * 0.42, cy - ry * 0.18, rx * 0.16, ry * 0.07, 16),
    RIGHT_EYE: ellipsePoints(cx + rx * 0.42, cy - ry * 0.18, rx * 0.16, ry * 0.07, 16),
    LEFT_EYEBROW_TOP: arcPoints(
      cx - rx * 0.42, cy - ry * 0.34, rx * 0.20, ry * 0.03, Math.PI, Math.PI * 2, 5,
    ),
    RIGHT_EYEBROW_TOP: arcPoints(
      cx + rx * 0.42, cy - ry * 0.34, rx * 0.20, ry * 0.03, Math.PI, Math.PI * 2, 5,
    ),
    NOSE_BRIDGE: [
      { x: cx, y: cy - ry * 0.25 },
      { x: cx, y: cy + ry * 0.15 },
    ],
    NOSE_BOTTOM: [
      { x: cx - rx * 0.12, y: cy + ry * 0.18 },
      { x: cx, y: cy + ry * 0.23 },
      { x: cx + rx * 0.12, y: cy + ry * 0.18 },
    ],
  };
}
