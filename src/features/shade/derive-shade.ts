// src/features/shade/derive-shade.ts
// Pure, deterministic mapping from raw scan-read descriptors -> a makeup shade
// (plan B2). No I/O, no store, no randomness: same input -> same CurrentShade.
//
// The output is a foundation-shade description in cosmetic language only (depth word +
// undertone word, e.g. "Medium Warm"). Depth is carried as tone DATA (1..10) but the UI
// renders it qualitatively (see depthWord) — no raw read dimension is shown as a number
// (CLAUDE.md §0/§1, plan Flag 4).
import type { Undertone, Finish } from '../../content/makeup-vocab';
import type { ShadeDepth } from '../match/match-types';
import type { SkinTypeFeel } from '../read/read-types';
import type { CurrentShade, ShadeReadInput } from './shade-types';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Cosmetic depth band word for a 1 (fairest) .. 10 (deepest) shade depth. */
export function depthWord(depth: ShadeDepth): string {
  if (depth <= 2) return 'Fair';
  if (depth <= 4) return 'Light';
  if (depth <= 6) return 'Medium';
  if (depth <= 8) return 'Tan';
  return 'Deep';
}

const UNDERTONE_WORD: Record<Undertone, string> = {
  warm: 'Warm',
  cool: 'Cool',
  neutral: 'Neutral',
  olive: 'Olive',
};

/** Map a 0 (deepest) .. 1 (fairest) lightness read to a 1..10 shade depth. */
export function deriveDepth(lightness: number): ShadeDepth {
  return clamp(Math.round((1 - clamp(lightness, 0, 1)) * 9) + 1, 1, 10);
}

/** Olive cast wins when strong; otherwise warmth sign picks warm/cool, near-zero = neutral. */
export function deriveUndertone(warmth: number, olive: number): Undertone {
  if (olive >= 0.5) return 'olive';
  if (warmth > 0.15) return 'warm';
  if (warmth < -0.15) return 'cool';
  return 'neutral';
}

/** Pick a flattering finish from how the skin reads: oilier -> matte, drier -> dewy. */
export function deriveFinish(skinType: SkinTypeFeel, oiliness: number): Finish {
  if (oiliness >= 0.6 || skinType === 'oily') return 'matte';
  if (skinType === 'dry') return 'dewy';
  if (skinType === 'combination') return 'satin';
  return 'natural';
}

/**
 * Derive the user's makeup shade from the on-device read. Pure: no side effects; the
 * caller (B2 result screen) persists it via A's personalization.setScan().
 */
export function deriveShade(read: ShadeReadInput): CurrentShade {
  const depth = deriveDepth(read.lightness);
  const undertone = deriveUndertone(read.warmth, read.olive);
  const finish = deriveFinish(read.skinType, read.oiliness);
  const shadeName = `${depthWord(depth)} ${UNDERTONE_WORD[undertone]}`;
  return { shadeName, undertone, depth, finish };
}
