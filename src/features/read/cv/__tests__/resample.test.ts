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

  it('retains far more texture energy than nearest-neighbour', () => {
    // The point of the change: nearest-neighbour point-samples every Nth pixel and aliases the
    // high-frequency detail that texture/pores/fineLines measure (spec F4).
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
    const meanOf = (im: any) => { let s = 0; for (let i = 0; i < im.data.length; i += 4) s += im.data[i]; return s / (im.data.length / 4); };
    const varOf = (im: any) => { const m = meanOf(im); let s = 0; for (let i = 0; i < im.data.length; i += 4) s += (im.data[i] - m) ** 2; return s / (im.data.length / 4); };
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
