// src/features/read/decode-output.ts
// Pure decoder: raw deep-stub model output -> derived cosmetic scores + skin-type feel.
// This is the host-testable half of the read engine; `executorch-engine.ts` (device-only)
// merely runs the native forward pass and hands its output here. Keeping it pure means the
// score->band->UI contract is verified on a workstation and the native shell stays thin
// (plan: "all real logic lives in small pure modules; native shells are thin").
//
// Output contract (must match scripts/export_stub_model.py):
//   index 0..7  -> sigmoid scores in 0..1, positionally mapped to DIMENSIONS (in order)
//   index 8..11 -> skin-type logits, argmax -> SKIN_TYPE_FEELS (in order)
import { DIMENSIONS, SKIN_TYPE_FEELS, type SkinTypeFeel } from '../../content/cosmetic-vocab';
import type { ScoreVector } from './read-types';

export const MODEL_OUTPUT_LENGTH = DIMENSIONS.length + SKIN_TYPE_FEELS.length; // 8 + 4 = 12

export interface DecodedRead {
  scores: ScoreVector;
  skinType: SkinTypeFeel;
}

export function argmax(values: ArrayLike<number>): number {
  if (values.length === 0) throw new Error('argmax: empty array');
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[best]) best = i;
  }
  return best;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export function decodeModelOutput(output: ArrayLike<number>): DecodedRead {
  if (output.length !== MODEL_OUTPUT_LENGTH) {
    throw new Error(`expected a model output of length ${MODEL_OUTPUT_LENGTH}, got ${output.length}`);
  }
  const scores = Object.fromEntries(
    // clamp defends the band contract: a stray native value can never escape 0..1
    DIMENSIONS.map((d, i) => [d, clamp01(output[i])]),
  ) as ScoreVector;
  const skinType = SKIN_TYPE_FEELS[argmax(Array.prototype.slice.call(output, DIMENSIONS.length))];
  return { scores, skinType };
}
