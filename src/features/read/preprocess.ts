// src/features/read/preprocess.ts
// Pure math half of preprocessing: a square RGB byte buffer -> normalized CHW float
// tensor. The native engine decodes/resizes the photo to INPUT_SIZE and calls this.
export const INPUT_SIZE = 224;
export const MEAN = [0.485, 0.456, 0.406] as const;
export const STD = [0.229, 0.224, 0.225] as const;

export function normalizeToTensor(rgb: Uint8Array, width: number, height: number): Float32Array {
  if (width !== INPUT_SIZE || height !== INPUT_SIZE) {
    throw new Error(`expected ${INPUT_SIZE}x${INPUT_SIZE} input, got ${width}x${height}`);
  }
  const expectedLength = 3 * INPUT_SIZE * INPUT_SIZE;
  if (rgb.length !== expectedLength) {
    throw new Error(`expected an RGB buffer of length ${expectedLength}, got ${rgb.length}`);
  }
  const plane = INPUT_SIZE * INPUT_SIZE;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      out[c * plane + i] = (rgb[i * 3 + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  return out;
}
