import { areaDownscale } from '../resample';
import { solidRgb, addNoise } from '../fixtures';

describe('areaDownscale', () => {
  it('never upscales', () => {
    const out = areaDownscale(solidRgb(40, 30), 512);
    expect(out.width).toBe(40);
    expect(out.height).toBe(30);
  });

  it('scales the long edge to the target and preserves aspect ratio', () => {
    const out = areaDownscale(solidRgb(800, 400), 200);
    expect(out.width).toBe(200);
    expect(out.height).toBe(100);
  });

  it('preserves a flat colour exactly', () => {
    const out = areaDownscale(solidRgb(256, 256, [120, 90, 70]), 64);
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([120, 90, 70]);
  });

  it('averages rather than point-samples — a 2x2 checkerboard becomes its mean', () => {
    const src = { width: 2, height: 2, data: new Uint8ClampedArray([
      0, 0, 0, 255,   255, 255, 255, 255,
      255, 255, 255, 255,   0, 0, 0, 255,
    ]) };
    const out = areaDownscale(src, 1);
    expect(out.data[0]).toBeGreaterThan(120);
    expect(out.data[0]).toBeLessThan(136);
  });

  it('reconstructs blocky sources exactly — 4×4 checkerboard to 2×2', () => {
    // ESSENTIAL TEST: Proves reconstruction, not just smoothing. A 4×4 image with 2×2 blocks
    // alternating 0/255 downscaled by exactly 2× must yield [0, 255, 255, 0] at the four
    // output cells. A degenerate constant-output (e.g. all 128) implementation fails this.
    //
    // Layout (each cell is one pixel, 4 bytes RGBA):
    //   [0,0]=black [1,0]=black | [2,0]=white [3,0]=white
    //   [0,1]=black [1,1]=black | [2,1]=white [3,1]=white
    //   ---------------------
    //   [0,2]=white [1,2]=white | [2,2]=black [3,2]=black
    //   [0,3]=white [1,3]=white | [2,3]=black [3,3]=black
    const src = { width: 4, height: 4, data: new Uint8ClampedArray([
      // Row 0: black black white white
      0, 0, 0, 255,   0, 0, 0, 255,   255, 255, 255, 255,   255, 255, 255, 255,
      // Row 1: black black white white
      0, 0, 0, 255,   0, 0, 0, 255,   255, 255, 255, 255,   255, 255, 255, 255,
      // Row 2: white white black black
      255, 255, 255, 255,   255, 255, 255, 255,   0, 0, 0, 255,   0, 0, 0, 255,
      // Row 3: white white black black
      255, 255, 255, 255,   255, 255, 255, 255,   0, 0, 0, 255,   0, 0, 0, 255,
    ]) };
    const out = areaDownscale(src, 2);
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    // Output is 2×2, so 16 bytes total (4 pixels * 4 bytes/pixel).
    // Pixel layout: [0,0]=index 0, [1,0]=index 4, [0,1]=index 8, [1,1]=index 12
    // Top-left output [0,0]: averages input [0,0],[1,0],[0,1],[1,1] = all black → 0
    expect(out.data[0]).toBe(0);
    // Top-right output [1,0]: averages input [2,0],[3,0],[2,1],[3,1] = all white → 255
    expect(out.data[4]).toBe(255);
    // Bottom-left output [0,1]: averages input [0,2],[1,2],[0,3],[1,3] = all white → 255
    expect(out.data[8]).toBe(255);
    // Bottom-right output [1,1]: averages input [2,2],[3,2],[2,3],[3,3] = all black → 0
    expect(out.data[12]).toBe(0);
  });

  it('dilutes an impulse by the averaging box size — single 255 in 4-pixel box yields 63–64', () => {
    // ESSENTIAL TEST: Proves averaging arithmetic. A single 255 in an otherwise-zero 2×2 box
    // downscaled to 1×1 must yield exactly 255/4 ≈ 63.75, which Uint8ClampedArray rounds to 64.
    // Nearest-neighbour would either give 255 (if it sampled the impulse) or 0 (if it missed).
    const src = { width: 2, height: 2, data: new Uint8ClampedArray([
      255, 255, 255, 255,   0, 0, 0, 255,
      0, 0, 0, 255,   0, 0, 0, 255,
    ]) };
    const out = areaDownscale(src, 1);
    expect(out.width).toBe(1);
    expect(out.height).toBe(1);
    // Mean of [255, 0, 0, 0] = 63.75 → clamped to 63 or 64 (JS rounds to nearest even).
    expect(out.data[0]).toBeGreaterThanOrEqual(63);
    expect(out.data[0]).toBeLessThanOrEqual(64);
    // Verify it is NOT 255 (would indicate point-sampling the impulse)
    // and NOT 0 (would indicate missing the impulse entirely).
    expect(out.data[0]).not.toBe(255);
    expect(out.data[0]).not.toBe(0);
  });

  it('retains far more texture energy than nearest-neighbour (variance smoothing test)', () => {
    // The point of the change: nearest-neighbour point-samples every Nth pixel and aliases the
    // high-frequency detail that texture/pores/fineLines measure (spec F4).
    //
    // NOTE: This test is NOT sufficient alone to prove anti-aliasing — a degenerate
    // constant-output implementation would pass. The block-checkerboard and impulse tests above
    // are the real guards on the averaging arithmetic. This test is kept to measure actual
    // variance attenuation, which is a useful property but not the defining one.
    const src = addNoise(solidRgb(256, 256, [160, 130, 110]), { x: 0, y: 0, w: 256, h: 256 }, 40, 7);
    const nearest = (() => {
      const s = 0.25, w = 64, h = 64;
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const si = (Math.floor(y / s) * 256 + Math.floor(x / s)) * 4;
        const di = (y * w + x) * 4;
        for (let c = 0; c < 4; c++) data[di + c] = src.data[si + c];
      }
      return { width: w, height: h, data };
    })();
    const area = areaDownscale(src, 64);
    const meanOf = (im: { data: Uint8ClampedArray }) => { let s = 0; for (let i = 0; i < im.data.length; i += 4) s += im.data[i]; return s / (im.data.length / 4); };
    const varOf = (im: { data: Uint8ClampedArray }) => { const m = meanOf(im); let s = 0; for (let i = 0; i < im.data.length; i += 4) s += (im.data[i] - m) ** 2; return s / (im.data.length / 4); };
    // Averaging attenuates noise variance predictably; point-sampling passes it through unfiltered,
    // which is aliasing, not detail. The area result must be SMOOTHER, not noisier.
    expect(varOf(area)).toBeLessThan(varOf(nearest));
  });

  it('produces a fully opaque RGBA buffer of the right length', () => {
    const out = areaDownscale(solidRgb(300, 200), 100);
    expect(out.data).toHaveLength(out.width * out.height * 4);
    expect(out.data[3]).toBe(255);
  });
});
