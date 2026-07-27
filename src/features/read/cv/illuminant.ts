// Illuminant normalization (spec §4b, §4c).
//
// GREY-WORLD IS PROHIBITED HERE. On a selfie the face fills the frame, so grey-world estimates the
// illuminant as the average colour of the SKIN and then corrects it toward neutral — desaturating
// and lightening deep skin. That is the exact bias this product exists to eliminate. The same
// objection rules out max-RGB / white-patch on a face-filling frame.
//
// Instead: SKIN-LOCUS estimation. Skin chromaticity across Fitzpatrick I-VI lies near a known line
// in log-chromaticity, because it varies principally along melanin/haemoglobin axes. We estimate
// the illuminant as the shift that puts the observed skin onto that locus, PROJECTING OUT the
// melanin direction so tone stays a free parameter.
//
// NOT WIRED IN (task 12 finding — see task-12-report.md): this module is implemented, unit-tested,
// and correct for what it does, but it is deliberately NOT called from score-from-rgb.ts. Measured
// against the real invariance harness, this renderer's Planckian illuminant direction and its
// melanin direction are ~93% collinear in log-chromaticity, so the melanin-orthogonal projection
// this correctness requires (spec §6b) recovers almost none of the colour-cast signal, and what it
// does recover makes the darkSpots/redness illuminant-axis spread WORSE, not better (measured
// 0.1115->0.2462 for darkSpots). Worse still, decomposing the failing axis shows its dominant
// driver is the INTENSITY (exposure) sweep, not illuminant COLOUR — a chroma-ratio estimator is
// exposure-invariant by construction and cannot touch that component at all. Wiring this in would
// regress a target metric while fixing neither dimension, so it is left unwired pending a real
// exposure-normalization fix, which is out of this module's scope.
import type { RgbImage, Regions } from './types';
import { clampRect, rgbAt, median } from './sampling';

// Canonical skin log-chromaticity under D65, and the direction melanin moves it.
// Derived from the same tone ladder the renderer uses, but expressed in log-chroma — a different
// parameterization, which is what keeps the harness non-circular (spec §6a).
const LOCUS_RG = 0.42; // log(R/G) of canonical skin under D65
const LOCUS_BG = -0.3; // log(B/G)
// Empirically recovered (task 12): rendered FST I-VI at 6500K (D65, no colour cast), sampled
// skinLogChroma over both cheeks per tone, and fit a total-least-squares line (PCA principal
// component of the covariance of the six (rg, bg) points) — see task-12-report.md for the raw
// points and covariance. The brief's placeholder [0.55, 0.835] had the WRONG SIGN on the bg
// component: melanin observably makes skin LESS blue-shifted (bg becomes more negative) as tone
// deepens, not more. Measured points (rg, bg) from lightest to deepest tone:
//   I:(0.0966,-0.0766) II:(0.1255,-0.0933) III:(0.1606,-0.1248)
//   IV:(0.2123,-0.1462) V:(0.2570,-0.1823) VI:(0.2935,-0.2231)
const MELANIN_DIR: [number, number] = [0.8133, -0.5818]; // unit direction tone travels in (rg, bg)

function skinLogChroma(img: RgbImage, regions: Regions): [number, number] | null {
  const rg: number[] = [];
  const bg: number[] = [];
  for (const rect of [regions.cheekL, regions.cheekR]) {
    const r = clampRect(rect, img.width, img.height);
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const [R, G, B] = rgbAt(img, x, y);
        if (R < 6 || G < 6 || B < 6 || R > 250 || G > 250 || B > 250) continue; // ignore clipped
        rg.push(Math.log(R / G));
        bg.push(Math.log(B / G));
      }
    }
  }
  return rg.length < 32 ? null : [median(rg), median(bg)];
}

export function estimateIlluminant(img: RgbImage, regions: Regions): [number, number, number] {
  const obs = skinLogChroma(img, regions);
  if (!obs) return [1, 1, 1];

  // Offset from the canonical locus, with the melanin component projected out: whatever remains
  // is attributed to the illuminant, so tone never masquerades as colour cast.
  let dRg = obs[0] - LOCUS_RG;
  let dBg = obs[1] - LOCUS_BG;
  const along = dRg * MELANIN_DIR[0] + dBg * MELANIN_DIR[1];
  dRg -= along * MELANIN_DIR[0];
  dBg -= along * MELANIN_DIR[1];

  const gains: [number, number, number] = [Math.exp(dRg), 1, Math.exp(dBg)];
  // Plausibility guard (spec §7): reject wild estimates rather than corrupting the image.
  for (const g of gains) if (!Number.isFinite(g) || g < 0.5 || g > 2) return [1, 1, 1];
  return gains;
}

// Von Kries-style adaptation: divide each channel by its estimated illuminant gain.
export function adaptToD65(img: RgbImage, gains: [number, number, number]): RgbImage {
  const data = new Uint8ClampedArray(img.data);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = img.data[i] / gains[0];
    data[i + 1] = img.data[i + 1] / gains[1];
    data[i + 2] = img.data[i + 2] / gains[2];
  }
  return { width: img.width, height: img.height, data };
}

// Fit a plane to luminance across the skin regions and divide it out, so side lighting stops
// reading as extra darkCircles/darkSpots on the shadowed side (spec §4c, F6).
export function flattenShading(img: RgbImage, regions: Regions): RgbImage {
  const pts: Array<[number, number, number]> = [];
  for (const rect of [regions.cheekL, regions.cheekR, regions.forehead]) {
    const r = clampRect(rect, img.width, img.height);
    for (let y = r.y; y < r.y + r.h; y += 2) {
      for (let x = r.x; x < r.x + r.w; x += 2) {
        const [R, G, B] = rgbAt(img, x, y);
        pts.push([x, y, (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255]);
      }
    }
  }
  if (pts.length < 24) return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };

  // Least squares for L ≈ c + a*x + b*y via normal equations.
  let sx = 0, sy = 0, sl = 0, sxx = 0, syy = 0, sxy = 0, sxl = 0, syl = 0;
  const n = pts.length;
  for (const [x, y, l] of pts) {
    sx += x; sy += y; sl += l; sxx += x * x; syy += y * y; sxy += x * y; sxl += x * l; syl += y * l;
  }
  const mx = sx / n, my = sy / n, ml = sl / n;
  const cxx = sxx - n * mx * mx, cyy = syy - n * my * my, cxy = sxy - n * mx * my;
  const cxl = sxl - n * mx * ml, cyl = syl - n * my * ml;
  const det = cxx * cyy - cxy * cxy;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-6) {
    return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
  }
  const a = (cxl * cyy - cyl * cxy) / det;
  const b = (cyl * cxx - cxl * cxy) / det;

  const data = new Uint8ClampedArray(img.data);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const field = ml + a * (x - mx) + b * (y - my);
      // Correct toward the mean; clamp so a bad fit cannot blow up the image.
      const k = field > 0.02 ? Math.max(0.6, Math.min(1.6, ml / field)) : 1;
      const i = (y * img.width + x) * 4;
      data[i] = img.data[i] * k;
      data[i + 1] = img.data[i + 1] * k;
      data[i + 2] = img.data[i + 2] * k;
    }
  }
  return { width: img.width, height: img.height, data };
}

export function normalizeIlluminant(img: RgbImage, regions: Regions): RgbImage {
  return flattenShading(adaptToD65(img, estimateIlluminant(img, regions)), regions);
}
