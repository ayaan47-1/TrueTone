// SOURCE OF TRUTH: src/features/read/read-types.ts — this copy is kept in sync manually.
import type { Dimension, SkinTypeFeel } from './cosmetic-vocab.ts';

export type { SkinTypeFeel };
export type ScoreVector = Record<Dimension, number>; // each 0..1

export interface ReadResult {
  scores: ScoreVector;
  skinType: SkinTypeFeel;
  modelVersion: string;
  isStub: boolean;
}
