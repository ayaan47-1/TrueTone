// jpeg-js ignores EXIF orientation; MLKit's still detector honours it. If the decoded buffer and
// the detector disagree about which way is up, every region lands wrong and nothing errors
// (spec F5, §11). This module makes the decode agree with the detector.
import type { RgbImage } from './cv/types';

const DEFAULT: 1 = 1;

// Only the rotations a phone camera actually produces. Mirrored variants (2/4/5/7) are folded to
// their unmirrored rotation: the front camera's mirroring is handled by the capture pipeline, and
// treating a mirrored tag as its rotation is strictly better than ignoring orientation entirely.
export function readExifOrientation(bytes: Uint8Array): 1 | 3 | 6 | 8 {
  try {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return DEFAULT;
    let off = 2;
    while (off + 4 <= bytes.length) {
      if (bytes[off] !== 0xff) return DEFAULT;
      const marker = bytes[off + 1];
      const size = (bytes[off + 2] << 8) | bytes[off + 3];
      if (size < 2) return DEFAULT;
      if (marker === 0xe1) {
        const start = off + 4;
        if (bytes[start] !== 0x45 || bytes[start + 1] !== 0x78) return DEFAULT; // 'Ex'
        const tiff = start + 6;
        if (tiff + 8 > bytes.length) return DEFAULT;
        const be = bytes[tiff] === 0x4d;
        const u16 = (p: number) => (be ? (bytes[p] << 8) | bytes[p + 1] : (bytes[p + 1] << 8) | bytes[p]);
        const u32 = (p: number) => (be
          ? ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0
          : ((bytes[p + 3] << 24) | (bytes[p + 2] << 16) | (bytes[p + 1] << 8) | bytes[p]) >>> 0);
        const ifd = tiff + u32(tiff + 4);
        if (ifd + 2 > bytes.length) return DEFAULT;
        const count = u16(ifd);
        for (let i = 0; i < count; i++) {
          const entry = ifd + 2 + i * 12;
          if (entry + 12 > bytes.length) return DEFAULT;
          if (u16(entry) === 0x0112) {
            const v = u16(entry + 8);
            return v === 3 || v === 6 || v === 8 ? v : DEFAULT;
          }
        }
        return DEFAULT;
      }
      if (marker === 0xda) return DEFAULT; // start of scan — no EXIF found
      off += 2 + size;
    }
    return DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function applyOrientation(img: RgbImage, orientation: number): RgbImage {
  if (orientation !== 3 && orientation !== 6 && orientation !== 8) {
    return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
  }
  const swap = orientation === 6 || orientation === 8;
  const w = swap ? img.height : img.width;
  const h = swap ? img.width : img.height;
  const data = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      let dx: number;
      let dy: number;
      if (orientation === 3) { dx = img.width - 1 - x; dy = img.height - 1 - y; }
      else if (orientation === 6) { dx = img.height - 1 - y; dy = x; }
      else { dx = y; dy = img.width - 1 - x; }
      const si = (y * img.width + x) * 4;
      const di = (dy * w + dx) * 4;
      data[di] = img.data[si];
      data[di + 1] = img.data[si + 1];
      data[di + 2] = img.data[si + 2];
      data[di + 3] = img.data[si + 3];
    }
  }
  return { width: w, height: h, data };
}
