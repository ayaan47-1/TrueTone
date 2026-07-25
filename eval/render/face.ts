// Physically-grounded synthetic face renderer (spec §6a).
//
// Forward path: reflectance → defect layers (in REFLECTANCE space, so every injury is a fractional
// change and therefore tone-equivalent) → Lambertian shading → specular lobe → illuminant multiply
// → exposure → sensor noise → sRGB encode.
import type { RgbImage, Rect } from '../../src/features/read/cv/types';
import type { Fitzpatrick } from '../fairness/fst';
import { SKIN_REFLECTANCE, planckianRgb } from './tone';
import { makeRng, valueNoise2d } from './noise';
import { faceEllipse, surfaceNormal, syntheticContours, type FaceContours, type RenderGeometry } from './geometry';

export interface DefectParams {
  spots: number; redness: number; oiliness: number; pores: number;
  lines: number; darkCircles: number; roughness: number;
}

export interface RenderParams {
  size: { width: number; height: number };
  fst: Fitzpatrick;
  illuminant: { tempK: number; intensity: number };
  shading: { azimuth: number; elevation: number; ambient: number };
  geometry: RenderGeometry;
  defects: DefectParams;
  sensorNoise: number;
  seed: number;
}

export interface RenderedFace { rgb: RgbImage; bbox: Rect; contours: FaceContours }

export const DEFAULT_PARAMS: RenderParams = {
  size: { width: 256, height: 256 },
  fst: 'III',
  illuminant: { tempK: 6500, intensity: 1 },
  shading: { azimuth: 0, elevation: Math.PI / 2, ambient: 0.55 },
  geometry: { scale: 1, dx: 0, dy: 0 },
  defects: { spots: 0, redness: 0, oiliness: 0, pores: 0, lines: 0, darkCircles: 0, roughness: 0 },
  sensorNoise: 0.004,
  seed: 1,
};

type Deep<T> = { [K in keyof T]?: T[K] extends object ? Deep<T[K]> : T[K] };

function merge(p: Deep<RenderParams> = {}): RenderParams {
  return {
    ...DEFAULT_PARAMS, ...p,
    size: { ...DEFAULT_PARAMS.size, ...p.size },
    illuminant: { ...DEFAULT_PARAMS.illuminant, ...p.illuminant },
    shading: { ...DEFAULT_PARAMS.shading, ...p.shading },
    geometry: { ...DEFAULT_PARAMS.geometry, ...p.geometry },
    defects: { ...DEFAULT_PARAMS.defects, ...p.defects },
  } as RenderParams;
}

const srgb = (v: number) =>
  Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));

// Smooth 0..1 falloff, 1 at the center of the blob, 0 at radius r.
function blob(x: number, y: number, cx: number, cy: number, r: number): number {
  const d = Math.hypot(x - cx, y - cy) / r;
  return d >= 1 ? 0 : (1 - d * d) ** 2;
}

export function renderFace(overrides: Deep<RenderParams> = {}): RenderedFace {
  const p = merge(overrides);
  const { width, height } = p.size;
  const e = faceEllipse(p.size, p.geometry);
  const rng = makeRng(p.seed);
  const micro = valueNoise2d(rng, width, height, 5);
  const coarse = valueNoise2d(makeRng(p.seed + 977), width, height, 2);
  const noiseRng = makeRng(p.seed + 5501);

  const base = SKIN_REFLECTANCE[p.fst];
  const illum = planckianRgb(p.illuminant.tempK);
  const L: [number, number, number] = [
    Math.cos(p.shading.elevation) * Math.cos(p.shading.azimuth),
    Math.cos(p.shading.elevation) * Math.sin(p.shading.azimuth),
    Math.sin(p.shading.elevation),
  ];
  const Ln = Math.hypot(...L);
  const Lu: [number, number, number] = [L[0] / Ln, L[1] / Ln, L[2] / Ln];
  const H: [number, number, number] = (() => {
    const h: [number, number, number] = [Lu[0], Lu[1], Lu[2] + 1];
    const n = Math.hypot(...h);
    return [h[0] / n, h[1] / n, h[2] / n];
  })();

  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const inside = ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2 < 1;
      const idx = y * width + x;

      // --- reflectance, with every defect applied as a FRACTIONAL modulation ---
      let refl: [number, number, number] = [base[0], base[1], base[2]];

      if (inside) {
        // pores + roughness: high-frequency multiplicative texture
        const tex = 1 + micro[idx] * (0.11 * p.defects.pores + 0.09 * p.defects.roughness);

        // dark spots: a few discrete blobs on forehead and cheeks
        let spot = 0;
        if (p.defects.spots > 0) {
          const sites: Array<[number, number]> = [
            [e.cx - e.rx * 0.3, e.cy - e.ry * 0.5],
            [e.cx + e.rx * 0.25, e.cy - e.ry * 0.42],
            [e.cx - e.rx * 0.5, e.cy + e.ry * 0.2],
            [e.cx + e.rx * 0.52, e.cy + e.ry * 0.26],
          ];
          for (const [sx, sy] of sites) spot = Math.max(spot, blob(x, y, sx, sy, e.rx * 0.11));
          spot *= p.defects.spots * 0.42;
        }

        // dark circles: infraorbital bands
        const dc = p.defects.darkCircles * 0.38 *
          Math.max(blob(x, y, e.cx - e.rx * 0.42, e.cy - e.ry * 0.05, e.rx * 0.26),
                   blob(x, y, e.cx + e.rx * 0.42, e.cy - e.ry * 0.05, e.rx * 0.26));

        // fine lines: oriented horizontal ridges beside the eyes
        const lineZone = Math.max(blob(x, y, e.cx - e.rx * 0.68, e.cy - e.ry * 0.16, e.rx * 0.3),
                                  blob(x, y, e.cx + e.rx * 0.68, e.cy - e.ry * 0.16, e.rx * 0.3));
        const line = p.defects.lines * 0.16 * lineZone * (0.5 + 0.5 * Math.sin(y * 1.9));

        const darken = 1 - Math.min(0.85, spot + dc + line);
        refl = [refl[0] * tex * darken, refl[1] * tex * darken, refl[2] * tex * darken];

        // redness: haemoglobin lifts R and suppresses G/B over the cheeks
        if (p.defects.redness > 0) {
          const cheek = Math.max(blob(x, y, e.cx - e.rx * 0.45, e.cy + e.ry * 0.22, e.rx * 0.4),
                                 blob(x, y, e.cx + e.rx * 0.45, e.cy + e.ry * 0.22, e.rx * 0.4));
          const k = p.defects.redness * cheek * 0.3;
          refl = [refl[0] * (1 + k), refl[1] * (1 - k * 0.55), refl[2] * (1 - k * 0.45)];
        }
      } else {
        // Neutral mid-grey backdrop, slightly textured so it is never a perfectly flat plane.
        const g = 0.18 + coarse[idx] * 0.02;
        refl = [g, g, g];
      }

      // --- shading ---
      const N = inside ? surfaceNormal(x, y, e) : ([0, 0, 1] as [number, number, number]);
      const lambert = Math.max(0, N[0] * Lu[0] + N[1] * Lu[1] + N[2] * Lu[2]);
      const shade = p.shading.ambient + (1 - p.shading.ambient) * lambert;

      // --- specular: illuminant-COLOURED, not skin-coloured. This is exactly why an absolute
      // luma threshold is the wrong oiliness detector (spec §6a). ---
      let spec = 0;
      if (inside && p.defects.oiliness > 0) {
        const tzone = Math.max(
          blob(x, y, e.cx, e.cy - e.ry * 0.45, e.rx * 0.55),   // forehead
          blob(x, y, e.cx, e.cy + e.ry * 0.05, e.rx * 0.22),   // nose
        );
        const ndh = Math.max(0, N[0] * H[0] + N[1] * H[1] + N[2] * H[2]);
        spec = p.defects.oiliness * tzone * Math.pow(ndh, 28) * 0.85;
      }

      for (let c = 0; c < 3; c++) {
        let v = (refl[c] * shade + spec) * illum[c] * p.illuminant.intensity;
        v += (noiseRng() * 2 - 1) * p.sensorNoise;
        data[i + c] = srgb(Math.max(0, Math.min(1, v)));
      }
      data[i + 3] = 255;
    }
  }

  return {
    rgb: { width, height, data },
    bbox: {
      x: Math.round(e.cx - e.rx), y: Math.round(e.cy - e.ry),
      w: Math.round(e.rx * 2), h: Math.round(e.ry * 2),
    },
    contours: syntheticContours(e),
  };
}
