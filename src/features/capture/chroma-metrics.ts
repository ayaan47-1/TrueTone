// src/features/capture/chroma-metrics.ts
// Pure chroma statistics from a downsampled RGB grid published by the frame worklet.
// Kept separate from the device-only worklet wiring so the math is host-testable.

export interface ChromaStats {
  clipping: number;  // 0..1 fraction of near-saturated samples
  cct: number;       // approximate correlated colour temperature, Kelvin
  imbalance: number; // 0..1 left/right mean-luma asymmetry
}

const CLIP_LEVEL = 250;

export function computeChromaStats(rgbGrid: number[], cols: number, rows: number): ChromaStats {
  const n = Math.min(cols * rows, Math.floor(rgbGrid.length / 3));
  if (n <= 0) return { clipping: 0, cct: 6500, imbalance: 0 };

  let clipped = 0;
  let sr = 0, sg = 0, sb = 0;
  let leftSum = 0, leftN = 0, rightSum = 0, rightN = 0;
  const half = cols / 2;

  for (let i = 0; i < n; i++) {
    const r = rgbGrid[i * 3];
    const g = rgbGrid[i * 3 + 1];
    const b = rgbGrid[i * 3 + 2];
    if (r >= CLIP_LEVEL || g >= CLIP_LEVEL || b >= CLIP_LEVEL) clipped++;
    sr += r; sg += g; sb += b;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (i % cols < half) { leftSum += luma; leftN++; } else { rightSum += luma; rightN++; }
  }

  const mr = sr / n, mg = sg / n, mb = sb / n;
  // McCamy's approximation over a crude sRGB->xy conversion. Precision is not the point: the gate
  // only needs to know "is this light wildly warm or wildly cool".
  const X = 0.4124 * mr + 0.3576 * mg + 0.1805 * mb;
  const Y = 0.2126 * mr + 0.7152 * mg + 0.0722 * mb;
  const Z = 0.0193 * mr + 0.1192 * mg + 0.9505 * mb;
  const sum = X + Y + Z;
  let cct = 6500;
  if (sum > 1e-6) {
    const x = X / sum;
    const y = Y / sum;
    if (Math.abs(y - 0.1858) > 1e-6) {
      const nn = (x - 0.3320) / (0.1858 - y);
      const est = 449 * nn ** 3 + 3525 * nn ** 2 + 6823.3 * nn + 5520.33;
      if (Number.isFinite(est)) cct = Math.max(1000, Math.min(15000, est));
    }
  }

  const l = leftN ? leftSum / leftN : 0;
  const r2 = rightN ? rightSum / rightN : 0;
  const denom = Math.max(l, r2);
  const imbalance = denom > 1e-6 ? Math.abs(l - r2) / denom : 0;

  return { clipping: clipped / n, cct, imbalance };
}
