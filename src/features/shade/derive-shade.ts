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
import type { Lab } from '../read/cv/types';
import type { CurrentShade, ShadeReadInput } from './shade-types';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// --- Phase 1 (tt-cam-pipeline): Lab -> tone descriptors -----------------------------------
// PROVISIONAL / UNCALIBRATED (CLAUDE.md §1/§7 -- no accuracy claim rides on these numbers
// yet): rough first-pass curves so the pipeline can produce *a* shade end to end. None of
// lo/hi below come from a measured skin corpus -- they are placeholder ranges picked to be
// directionally sane. TODO Phase 2: replace with a real calibration sweep against rendered
// skin-tone fixtures (the same fixture/tone-ladder infra cv/calibration.ts and
// cv/illuminant.ts already use for the differential health scores), the way calibration.ts's
// own header describes for those dimensions.
const TONE_LAB_LO = 20; // L* PLACEHOLDER floor (very deep skin, uncalibrated)
const TONE_LAB_HI = 80; // L* PLACEHOLDER ceiling (very fair skin, uncalibrated)
const WARMTH_B_SCALE = 30; // b* PLACEHOLDER scale mapping yellow(+)/blue(-) cast to -1..1
// PLACEHOLDER olive heuristic: a green-yellow cast reads as LOW a* (little red) combined with
// a positive b* (yellow) -- there is no validated undertone model behind this combination,
// see the tt-cam-cv-scope report (2026-09-02) for why (zero prior art in this codebase).
const OLIVE_LO = -10; // (b - 2a) PLACEHOLDER floor
const OLIVE_HI = 40; // (b - 2a) PLACEHOLDER ceiling

/**
 * Rough first-pass mapping from a raw CIELAB tone read (ReadEngine's ReadResult.tone) to the
 * lightness/warmth/olive descriptors deriveShade() consumes. UNCALIBRATED placeholder curves
 * (see constants above) -- Phase 2 replaces these with a real calibration sweep. Pure.
 */
export function deriveToneFromLab(lab: Lab): Pick<ShadeReadInput, 'lightness' | 'warmth' | 'olive'> {
  const lightness = clamp((lab.L - TONE_LAB_LO) / (TONE_LAB_HI - TONE_LAB_LO), 0, 1);
  const warmth = clamp(lab.b / WARMTH_B_SCALE, -1, 1);
  const oliveRaw = lab.b - 2 * lab.a;
  const olive = clamp((oliveRaw - OLIVE_LO) / (OLIVE_HI - OLIVE_LO), 0, 1);
  return { lightness, warmth, olive };
}

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
