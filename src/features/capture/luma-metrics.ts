// src/features/capture/luma-metrics.ts
//
// Pure luma → {brightness, sharpness} math for the quality gate. The device-only frame processor
// (use-frame-metrics.ts) samples the camera's Y (luma) plane down to a small grid in a worklet and
// hands that grid here, on the JS thread — so this math is the single, host-testable source of
// truth. These are global stats, so they're orientation-invariant (no rotation/mirroring needed).
import type { FrameMetrics } from './quality-gate';

export interface LumaStats {
  brightness: FrameMetrics['brightness'];
  sharpness: FrameMetrics['sharpness'];
}

// Mean absolute neighbour gradient (0..255) is mapped to 0..1 by dividing by this scale. ~24 means
// an average neighbour difference of 12 reads as "in focus" (0.5). Tune on a physical device.
export const SHARPNESS_SCALE = 24;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * @param grid row-major luma samples (0..255), length >= cols*rows
 * @param cols number of sampled columns
 * @param rows number of sampled rows
 */
export function computeLumaStats(grid: ArrayLike<number>, cols: number, rows: number): LumaStats {
  const n = cols * rows;
  if (n <= 0 || grid.length < n) return { brightness: 0, sharpness: 0 };

  let sum = 0;
  for (let i = 0; i < n; i++) sum += grid[i];
  const brightness = clamp01(sum / n / 255);

  // Mean absolute gradient to the right + bottom neighbour — a cheap focus/blur proxy.
  let gradSum = 0;
  let gradCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = grid[r * cols + c];
      if (c + 1 < cols) {
        gradSum += Math.abs(grid[r * cols + c + 1] - v);
        gradCount++;
      }
      if (r + 1 < rows) {
        gradSum += Math.abs(grid[(r + 1) * cols + c] - v);
        gradCount++;
      }
    }
  }
  const meanGrad = gradCount > 0 ? gradSum / gradCount : 0;
  return { brightness, sharpness: clamp01(meanGrad / SHARPNESS_SCALE) };
}
