// src/features/read/__tests__/preprocess.test.ts
import { normalizeToTensor, INPUT_SIZE, MEAN, STD } from '../preprocess';

test('produces a CHW float tensor of the right length', () => {
  const rgb = new Uint8Array(INPUT_SIZE * INPUT_SIZE * 3).fill(255);
  const t = normalizeToTensor(rgb, INPUT_SIZE, INPUT_SIZE);
  expect(t).toHaveLength(3 * INPUT_SIZE * INPUT_SIZE);
  // white pixel, channel 0: (1 - mean)/std
  expect(t[0]).toBeCloseTo((1 - MEAN[0]) / STD[0], 5);
});
test('lays out channels first (R plane, then G, then B)', () => {
  const rgb = new Uint8Array(INPUT_SIZE * INPUT_SIZE * 3);
  rgb[1] = 255; // green of pixel 0
  const plane = INPUT_SIZE * INPUT_SIZE;
  const t = normalizeToTensor(rgb, INPUT_SIZE, INPUT_SIZE);
  expect(t[plane + 0]).toBeCloseTo((1 - MEAN[1]) / STD[1], 5); // G plane, pixel 0
  expect(t[0]).toBeCloseTo((0 - MEAN[0]) / STD[0], 5);          // R plane, pixel 0 is black
});
test('rejects wrong input dimensions', () => {
  expect(() => normalizeToTensor(new Uint8Array(12), 2, 2)).toThrow(/expected/);
});
