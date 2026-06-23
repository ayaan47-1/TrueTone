import { base64ToBytes, downscaleRgba, WORKING_EDGE } from '../decode-rgb';

test('base64ToBytes decodes a known base64 string', () => {
  // "AQID" is the base64 of bytes [1, 2, 3]
  expect(Array.from(base64ToBytes('AQID'))).toEqual([1, 2, 3]);
});

test('base64ToBytes ignores whitespace/newlines in the input', () => {
  expect(Array.from(base64ToBytes('AQ\nID'))).toEqual([1, 2, 3]);
});

test('downscaleRgba shrinks the long edge to the target and keeps RGBA length', () => {
  const src = { width: 1024, height: 512, data: new Uint8Array(1024 * 512 * 4).fill(200) };
  const out = downscaleRgba(src, WORKING_EDGE);
  expect(Math.max(out.width, out.height)).toBe(WORKING_EDGE);
  expect(out.height).toBe(256); // aspect ratio preserved
  expect(out.data).toHaveLength(out.width * out.height * 4);
});

test('downscaleRgba never upscales a small image', () => {
  const src = { width: 10, height: 8, data: new Uint8Array(10 * 8 * 4) };
  const out = downscaleRgba(src, WORKING_EDGE);
  expect(out.width).toBe(10);
  expect(out.height).toBe(8);
});

test('downscaleRgba preserves a solid colour', () => {
  const data = new Uint8ClampedArray(800 * 800 * 4);
  for (let i = 0; i < 800 * 800; i++) {
    data[i * 4] = 210;
    data[i * 4 + 1] = 120;
    data[i * 4 + 2] = 90;
    data[i * 4 + 3] = 255;
  }
  const out = downscaleRgba({ width: 800, height: 800, data }, WORKING_EDGE);
  expect([out.data[0], out.data[1], out.data[2], out.data[3]]).toEqual([210, 120, 90, 255]);
});
