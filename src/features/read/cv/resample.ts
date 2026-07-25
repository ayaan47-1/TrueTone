// Area-averaged (box) downscale. Every destination pixel is the mean of the full source rectangle
// it covers, so no source pixel is discarded.
//
// Why this matters: the previous nearest-neighbour path point-sampled roughly every sixth pixel
// when reducing a ~3000px photo to a 512px working edge, aliasing exactly the high-frequency
// detail that texture, pores and fineLines exist to measure (spec F4).
import type { RgbImage } from './types';

export function areaDownscale(
  src: { width: number; height: number; data: Uint8Array | Uint8ClampedArray },
  edge: number,
): RgbImage {
  const scale = Math.min(1, edge / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const data = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor((y * src.height) / h);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * src.height) / h));
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor((x * src.width) / w);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * src.width) / w));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = sy0; sy < sy1 && sy < src.height; sy++) {
        for (let sx = sx0; sx < sx1 && sx < src.width; sx++) {
          const si = (sy * src.width + sx) * 4;
          r += src.data[si]; g += src.data[si + 1]; b += src.data[si + 2]; n++;
        }
      }
      const di = (y * w + x) * 4;
      data[di] = r / n; data[di + 1] = g / n; data[di + 2] = b / n; data[di + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}
