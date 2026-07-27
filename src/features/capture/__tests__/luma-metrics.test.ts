import { computeLumaStats, SHARPNESS_SCALE } from '../luma-metrics';

// Build a cols×rows grid from a per-cell function.
function grid(cols: number, rows: number, fn: (c: number, r: number) => number): number[] {
  const out: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(fn(c, r));
  return out;
}

describe('computeLumaStats', () => {
  it('guards empty / undersized grids', () => {
    expect(computeLumaStats([], 0, 0)).toEqual({ brightness: 0, sharpness: 0 });
    expect(computeLumaStats([1, 2], 4, 4)).toEqual({ brightness: 0, sharpness: 0 });
  });

  it('computes brightness as mean luma / 255', () => {
    expect(computeLumaStats(grid(8, 8, () => 128), 8, 8).brightness).toBeCloseTo(128 / 255, 4);
    expect(computeLumaStats(grid(8, 8, () => 255), 8, 8).brightness).toBe(1);
    expect(computeLumaStats(grid(8, 8, () => 0), 8, 8).brightness).toBe(0);
  });

  it('measures the centered face area instead of a bright background border', () => {
    const face = grid(10, 10, (c, r) =>
      c >= 2 && c < 8 && r >= 2 && r < 8 ? 51 : 255,
    );

    const stats = computeLumaStats(face, 10, 10);

    expect(stats.brightness).toBeCloseTo(0.2, 4);
    expect(stats.sharpness).toBe(0);
  });

  it('reports zero sharpness for a flat (out-of-focus) field', () => {
    expect(computeLumaStats(grid(16, 16, () => 140), 16, 16).sharpness).toBe(0);
  });

  it('reports high sharpness for a high-contrast (in-focus) texture', () => {
    const checker = grid(16, 16, (c, r) => ((c + r) % 2 === 0 ? 0 : 255));
    expect(computeLumaStats(checker, 16, 16).sharpness).toBe(1); // mean grad 255 → clamps to 1
  });

  it('scales a moderate texture into (0,1) via SHARPNESS_SCALE', () => {
    // neighbours differ by exactly SHARPNESS_SCALE/2 → sharpness 0.5
    const diff = SHARPNESS_SCALE / 2;
    const ramp = grid(16, 16, (c, r) => 120 + ((c + r) % 2) * diff);
    expect(computeLumaStats(ramp, 16, 16).sharpness).toBeCloseTo(0.5, 5);
  });

  it('a bright, textured field passes both the lighting and focus gates', () => {
    const lit = grid(16, 16, (c, r) => 150 + ((c + r) % 2) * 30); // mean ~165 → 0.65, grad 30
    const { brightness, sharpness } = computeLumaStats(lit, 16, 16);
    expect(brightness).toBeGreaterThan(0.35);
    expect(brightness).toBeLessThan(0.9);
    expect(sharpness).toBeGreaterThanOrEqual(0.5);
  });
});
