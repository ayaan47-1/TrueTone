// src/features/read/stub-read.ts
//
// DEV-ONLY placeholder read. Produces plausible mid-range cosmetic scores so the result + routine
// UI can be exercised on-device BEFORE the real executorch read engine exists (CLAUDE.md Task 4.2).
//
// This is NOT a real analysis and must never be presented as one: `isStub: true` is persisted with
// the scan so the data is always distinguishable from a genuine read. Scores are deterministic (no
// Math.random) for a stable demo, with a mild per-dimension spread so the bands render varied.
import { DIMENSIONS } from '../../content/cosmetic-vocab';
import type { ReadResult, ScoreVector } from './read-types';

export const STUB_MODEL_VERSION = 'stub-dev';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function stubRead(): ReadResult {
  const scores = Object.fromEntries(
    // 0.40–0.58, gently varied per dimension — all comfortably within [0, 1].
    DIMENSIONS.map((d, i) => [d, round2(0.4 + 0.09 * (1 + Math.sin(i * 1.7)))]),
  ) as ScoreVector;
  return { scores, skinType: 'combination', modelVersion: STUB_MODEL_VERSION, isStub: true };
}
