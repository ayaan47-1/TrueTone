import { computeChromaStats } from '../chroma-metrics';

const grid = (cols: number, rows: number, rgb: [number, number, number]) =>
  Array.from({ length: cols * rows * 3 }, (_, i) => rgb[i % 3]);

describe('computeChromaStats', () => {
  it('reports no clipping on a mid-grey frame', () => {
    expect(computeChromaStats(grid(8, 8, [128, 128, 128]), 8, 8).clipping).toBeCloseTo(0);
  });

  it('reports full clipping on a blown-out frame', () => {
    expect(computeChromaStats(grid(8, 8, [255, 255, 255]), 8, 8).clipping).toBeCloseTo(1);
  });

  it('estimates a warm CCT for a red-heavy frame and a cool one for blue-heavy', () => {
    const warm = computeChromaStats(grid(8, 8, [200, 140, 90]), 8, 8).cct;
    const cool = computeChromaStats(grid(8, 8, [120, 150, 210]), 8, 8).cct;
    expect(warm).toBeLessThan(cool);
  });

  it('reports zero imbalance on a uniform frame', () => {
    expect(computeChromaStats(grid(8, 8, [140, 120, 100]), 8, 8).imbalance).toBeCloseTo(0, 2);
  });

  it('reports high imbalance when one half is much brighter', () => {
    const cols = 8, rows = 8;
    const g: number[] = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const v = x < cols / 2 ? 40 : 220;
      g.push(v, v, v);
    }
    expect(computeChromaStats(g, cols, rows).imbalance).toBeGreaterThan(0.5);
  });

  it('never returns NaN on a degenerate all-black frame', () => {
    const s = computeChromaStats(grid(4, 4, [0, 0, 0]), 4, 4);
    for (const v of [s.clipping, s.cct, s.imbalance]) expect(Number.isFinite(v)).toBe(true);
  });
});
