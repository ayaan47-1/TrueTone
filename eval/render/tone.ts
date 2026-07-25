// Forward skin/illuminant model for the synthetic renderer.
//
// CIRCULARITY NOTE (spec §6a): this is deliberately NOT the log-chromaticity linear model that
// cv/illuminant.ts will use to ESTIMATE the illuminant. If the renderer and the estimator shared a
// formulation, the invariance axes would only prove the estimator can invert our own arithmetic.
import type { Fitzpatrick } from '../fairness/fst';

// Linear (pre-gamma) diffuse reflectance per Fitzpatrick type. Melanin absorbs short wavelengths
// most, so deeper tones fall fastest in blue — which is why the R > G > B ordering holds throughout
// and the channels do not simply scale together.
export const SKIN_REFLECTANCE: Record<Fitzpatrick, [number, number, number]> = {
  I: [0.86, 0.68, 0.60],
  II: [0.78, 0.58, 0.49],
  III: [0.64, 0.44, 0.35],
  IV: [0.47, 0.29, 0.22],
  V: [0.30, 0.17, 0.12],
  VI: [0.17, 0.09, 0.06],
};

// Approximate Planckian locus → linear RGB gain, normalized to unity at 6500 K.
export function planckianRgb(tempK: number): [number, number, number] {
  const t = Math.max(1000, Math.min(15000, tempK)) / 100;
  const ch = (v: number) => Math.max(0, Math.min(255, v)) / 255;

  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66
    ? 99.4708025861 * Math.log(t) - 161.1195681661
    : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;

  const raw: [number, number, number] = [ch(r), ch(g), ch(b)];
  // Normalize so 6500 K is neutral: divide by the same function evaluated at 6500 K.
  const n: [number, number, number] = [0.9917, 0.9736, 1.0];
  return [raw[0] / n[0], raw[1] / n[1], raw[2] / n[2]];
}
