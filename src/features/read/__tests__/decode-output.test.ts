// src/features/read/__tests__/decode-output.test.ts
import { decodeModelOutput, MODEL_OUTPUT_LENGTH, argmax } from '../decode-output';
import { DIMENSIONS, SKIN_TYPE_FEELS } from '../../../content/cosmetic-vocab';

// The deep-stub model emits [8 sigmoid scores (0..1)] ++ [4 skin-type logits].
function makeOutput(scores: number[], skinLogits: number[]): Float32Array {
  return Float32Array.from([...scores, ...skinLogits]);
}

const eightHalves = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];

describe('argmax', () => {
  test('returns the index of the largest value', () => {
    expect(argmax([0.1, 0.9, 0.3, 0.2])).toBe(1);
    expect(argmax([5, 1, 1, 1])).toBe(0);
    expect(argmax([1, 1, 1, 9])).toBe(3);
  });
  test('ties resolve to the first occurrence', () => {
    expect(argmax([0.4, 0.4, 0.1, 0.1])).toBe(0);
  });
  test('throws on an empty array', () => {
    expect(() => argmax([])).toThrow(/empty/i);
  });
});

describe('decodeModelOutput', () => {
  test('maps the first eight values to a score for every dimension, in order', () => {
    const out = makeOutput([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], [0, 0, 0, 0]);
    const r = decodeModelOutput(out);
    expect(Object.keys(r.scores)).toHaveLength(DIMENSIONS.length);
    expect(r.scores.hydration).toBeCloseTo(0.1, 6);
    expect(r.scores.darkCircles).toBeCloseTo(0.8, 6);
    // exact positional mapping
    DIMENSIONS.forEach((d, i) => expect(r.scores[d]).toBeCloseTo(out[i], 6));
  });

  test('picks the skin type by argmax of the last four logits', () => {
    // logit index 2 is largest -> SKIN_TYPE_FEELS[2] === 'combination'
    const r = decodeModelOutput(makeOutput(eightHalves, [-1, 0, 3, 1]));
    expect(r.skinType).toBe(SKIN_TYPE_FEELS[2]);
    expect(r.skinType).toBe('combination');
  });

  test('is deterministic and input-dependent (different input -> different result)', () => {
    const a = decodeModelOutput(makeOutput([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], [9, 0, 0, 0]));
    const b = decodeModelOutput(makeOutput([0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1], [0, 0, 0, 9]));
    expect(a.skinType).toBe('dry');
    expect(b.skinType).toBe('sensitive');
    expect(a.scores.hydration).not.toBeCloseTo(b.scores.hydration, 6);
  });

  test('clamps scores into 0..1 so a stray model value can never escape the band contract', () => {
    const r = decodeModelOutput(makeOutput([-0.5, 2.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], [1, 0, 0, 0]));
    expect(r.scores.hydration).toBe(0);
    expect(r.scores.oiliness).toBe(1);
  });

  test('accepts a number[] as well as a Float32Array', () => {
    const r = decodeModelOutput([...eightHalves, 1, 0, 0, 0]);
    expect(r.scores.hydration).toBeCloseTo(0.5, 6);
    expect(r.skinType).toBe('dry');
  });

  test('rejects an output of the wrong length', () => {
    expect(() => decodeModelOutput(Float32Array.from([0, 1, 2]))).toThrow(/expected .*length/i);
    expect(MODEL_OUTPUT_LENGTH).toBe(12);
  });
});
