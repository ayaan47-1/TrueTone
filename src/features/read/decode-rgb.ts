// JPEG → RGBA decode for the on-device read. The heavy lifting is a PURE-JS codec (jpeg-js) plus
// a pure downscale, so most of this file is host-testable; only the file read + codec invocation
// run on a device. The raw image stays on-device and is deleted by withImageCleanup after the read
// (CLAUDE.md §1, §3). jpeg-js is a pure-function codec (no network, no SDK/vendor that exfiltrates).
import { Platform } from 'react-native';
import type { RgbImage } from './cv/types';

export const WORKING_EDGE = 512;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

// Pure base64 → bytes (avoids depending on Buffer/atob being present in the RN runtime).
// Non-alphabet characters (whitespace, '=' padding, an accidental data-URI prefix's punctuation)
// map to -1 in the lookup table and are skipped, so the input need not be pre-cleaned.
export function base64ToBytes(b64: string): Uint8Array {
  const out = new Uint8Array(Math.floor((b64.length * 3) / 4) + 3);
  let bits = 0;
  let acc = 0;
  let oi = 0;
  for (let i = 0; i < b64.length; i++) {
    const v = B64_LOOKUP[b64.charCodeAt(i)];
    if (v < 0) continue;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[oi++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, oi);
}

// Pure nearest-neighbour downscale of an RGBA buffer to a target longest edge. Upscaling is never
// done (scale is clamped to 1) — the working image is at most WORKING_EDGE on its long side.
export function downscaleRgba(
  src: { width: number; height: number; data: Uint8Array | Uint8ClampedArray },
  edge: number,
): RgbImage {
  const scale = Math.min(1, edge / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.height - 1, Math.floor(y / scale));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, Math.floor(x / scale));
      const si = (sy * src.width + sx) * 4;
      const di = (y * w + x) * 4;
      data[di] = src.data[si];
      data[di + 1] = src.data[si + 1];
      data[di + 2] = src.data[si + 2];
      data[di + 3] = src.data[si + 3];
    }
  }
  return { width: w, height: h, data };
}

// DEVICE: reads the captured JPEG and decodes it to a fixed working-size RGBA RgbImage.
// Web preview has no native file read → throw so the __DEV__ stub fallback in run-read takes over.
// The expo-file-system + jpeg-js calls are lazy-required so they never enter the Jest module graph
// (the engine's tests inject a fake decode; this body never runs under Jest). Verify the
// readAsStringAsync base64 path + jpeg-js RGBA layout on the first physical-device run.
export async function decodeJpegToRgb(uri: string): Promise<RgbImage> {
  if (Platform.OS === 'web') {
    throw new Error('decodeJpegToRgb: native-only (no web pixel decode); web preview uses the dev stub');
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const legacy = require('expo-file-system/legacy');
  // On SDK 56 the legacy subpath exposes readAsStringAsync; fall back to the main module if not.
  const FileSystem =
    legacy && typeof legacy.readAsStringAsync === 'function'
      ? legacy
      : // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('expo-file-system');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jpeg = require('jpeg-js');
  const base64: string = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const bytes = base64ToBytes(base64);
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true }) as {
    width: number;
    height: number;
    data: Uint8Array;
  };
  return downscaleRgba(decoded, WORKING_EDGE);
}
