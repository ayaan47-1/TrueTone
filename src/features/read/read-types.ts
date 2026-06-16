// src/features/read/read-types.ts
import type { Dimension, SkinTypeFeel } from '../../content/cosmetic-vocab';

export type { SkinTypeFeel };
export type ScoreVector = Record<Dimension, number>; // each 0..1

export interface ReadResult {
  scores: ScoreVector;
  skinType: SkinTypeFeel;
  modelVersion: string;
  isStub: boolean;
}
