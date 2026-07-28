import { balancedBlockNoise2d, blockNoise2d, makeRng, valueNoise2d } from '../noise';

describe('makeRng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('differs between seeds', () => {
    expect(makeRng(1)()).not.toEqual(makeRng(2)());
  });

  it('stays within [0, 1)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('valueNoise2d', () => {
  // Mean-centering and peak-normalization are GUARANTEED by the implementation, not hoped for.
  // A coarse base lattice is only 3x3 = 9 random values, and every pixel interpolates those same
  // nine — so without explicit centering the field carries a large arbitrary DC offset no matter
  // how many pixels it has. In the renderer that offset would systematically brighten or darken
  // the skin, leaking into tone.
  const meanOf = (n: Float32Array) => n.reduce((s, v) => s + v, 0) / n.length;
  // High-frequency energy: mean absolute difference between horizontally adjacent samples.
  // This is what "more octaves = more detail" actually means. Global variance is NOT the right
  // measure — adding finer octaves at halved amplitude lowers global variance while raising detail.
  const hfEnergy = (n: Float32Array, w: number, h: number) => {
    let s = 0, c = 0;
    for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) { s += Math.abs(n[y * w + x] - n[y * w + x - 1]); c++; }
    return s / c;
  };

  it('returns one sample per pixel', () => {
    expect(valueNoise2d(makeRng(1), 16, 8, 3)).toHaveLength(128);
  });

  it('is zero-mean by construction', () => {
    expect(meanOf(valueNoise2d(makeRng(3), 64, 64, 4))).toBeCloseTo(0, 5);
  });

  it('is zero-mean even at a single coarse octave, where lattice bias is worst', () => {
    expect(meanOf(valueNoise2d(makeRng(11), 64, 64, 1))).toBeCloseTo(0, 5);
  });

  it('is normalized to a peak amplitude of exactly 1', () => {
    // The renderer applies this as `1 + noise * amplitude`, so a predictable peak is what makes
    // the amplitude parameters mean the same thing at every octave count.
    const n = valueNoise2d(makeRng(5), 64, 64, 4);
    expect(Math.max(...Array.from(n).map(Math.abs))).toBeCloseTo(1, 5);
  });

  it('produces more high-frequency detail with more octaves', () => {
    const at = (oct: number) => hfEnergy(valueNoise2d(makeRng(5), 64, 64, oct), 64, 64);
    const [o1, o3, o5] = [at(1), at(3), at(5)];
    expect(o3).toBeGreaterThan(o1);
    expect(o5).toBeGreaterThan(o3);
  });
});

describe('valueNoise2d baseCells', () => {
  const hfEnergy = (n: Float32Array, w: number, h: number) => {
    let s = 0, c = 0;
    for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) { s += Math.abs(n[y * w + x] - n[y * w + x - 1]); c++; }
    return s / c;
  };

  it('defaults to the previous behaviour when baseCells is omitted', () => {
    const a = valueNoise2d(makeRng(4), 32, 32, 3);
    const b = valueNoise2d(makeRng(4), 32, 32, 3, 2);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('produces far more pixel-scale detail at a high baseCells', () => {
    const coarse = hfEnergy(valueNoise2d(makeRng(7), 128, 128, 2, 2), 128, 128);
    const fine = hfEnergy(valueNoise2d(makeRng(7), 128, 128, 2, 64), 128, 128);
    expect(fine).toBeGreaterThan(coarse * 5);
  });

  it('is still zero-mean and peak-normalized at a high baseCells', () => {
    const n = valueNoise2d(makeRng(9), 128, 128, 2, 64);
    expect(n.reduce((s, v) => s + v, 0) / n.length).toBeCloseTo(0, 5);
    expect(Math.max(...Array.from(n).map(Math.abs))).toBeCloseTo(1, 5);
  });
});

describe('blockNoise2d', () => {
  it('keeps each several-pixel texture cell spatially correlated', () => {
    const n = blockNoise2d(makeRng(13), 12, 8, 4);

    expect(n[0]).toBe(n[3]);
    expect(n[0]).toBe(n[3 * 12 + 3]);
    expect(n[0]).not.toBe(n[4]);
  });

  it('is zero-mean and peak-normalized', () => {
    const n = blockNoise2d(makeRng(9), 64, 64, 4);

    expect(n.reduce((sum, value) => sum + value, 0) / n.length).toBeCloseTo(0, 5);
    expect(Math.max(...Array.from(n).map(Math.abs))).toBeCloseTo(1, 5);
  });
});

describe('balancedBlockNoise2d', () => {
  it('balances every complete 2x2 group of correlated cells', () => {
    const size = 4;
    const width = 16;
    const n = balancedBlockNoise2d(makeRng(13), width, 16, size);
    const cell = (x: number, y: number) => n[(y * size) * width + x * size];

    for (let y = 0; y < 4; y += 2) {
      for (let x = 0; x < 4; x += 2) {
        expect(cell(x, y) + cell(x + 1, y) + cell(x, y + 1) + cell(x + 1, y + 1))
          .toBeCloseTo(0, 6);
      }
    }
  });

  it('retains several-pixel correlation and normalized amplitude', () => {
    const n = balancedBlockNoise2d(makeRng(9), 16, 16, 4);
    expect(n[0]).toBe(n[3]);
    expect(n[0]).toBe(n[3 * 16 + 3]);
    expect(Math.max(...Array.from(n).map(Math.abs))).toBeCloseTo(1, 5);
  });
});
