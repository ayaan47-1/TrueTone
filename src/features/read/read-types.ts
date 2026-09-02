// src/features/read/read-types.ts
import type { Dimension, SkinTypeFeel } from '../../content/cosmetic-vocab';
import type { Lab } from './cv/types';

export type { SkinTypeFeel };
export type ScoreVector = Record<Dimension, number>; // each 0..1

export interface ReadResult {
  scores: ScoreVector;
  skinType: SkinTypeFeel;
  modelVersion: string;
  isStub: boolean;
  captureQuality?: 'good' | 'fair' | 'poor';
  /**
   * Phase 1 (tt-cam-pipeline): the cheek-region median CIELAB read (cv/baseline.ts's
   * SkinBaseline, L/a/b only) -- the raw tone data shade derivation feeds on
   * (see shade/derive-shade.ts's deriveToneFromLab). Undefined for stub reads, which have
   * no real CV tone. Never presented to the user as a number (CLAUDE.md §0/§1).
   */
  tone?: Lab;
}
