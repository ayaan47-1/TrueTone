// src/features/shade/shade-history.ts
// Shade history labels (Dwight ruling, shade-history-ruling.md). A saved match is a LOG of past
// matches shown as words, never a measurement: the numeric depth is converted to a band word
// here and the number is dropped before anything is persisted (data minimization, CLAUDE.md §3).
import { FINISH_LABELS, UNDERTONE_LABELS, type Finish, type Undertone } from '../../content/makeup-vocab';
import type { CurrentShade } from '../session/personalization';
import { depthWord } from './derive-shade';

export const DEPTH_BANDS = ['fair', 'light', 'medium', 'tan', 'deep'] as const;
export type DepthBand = (typeof DEPTH_BANDS)[number];

/** A saved shade match: cosmetic words only, as stored in the scans table. */
export interface ShadeLabels {
  readonly depthBand: DepthBand;
  readonly undertone: Undertone;
  readonly finish: Finish;
  readonly shadeName: string;
}

const BAND_WORD: Record<DepthBand, string> = {
  fair: 'Fair', light: 'Light', medium: 'Medium', tan: 'Tan', deep: 'Deep',
};

export function toShadeLabels(shade: CurrentShade): ShadeLabels {
  return {
    depthBand: depthWord(shade.depth).toLowerCase() as DepthBand,
    undertone: shade.undertone,
    finish: shade.finish,
    shadeName: shade.shadeName,
  };
}

/** "Tan · Warm · Satin" — the only way a saved match is rendered. */
export function formatShadeMatch(m: ShadeLabels): string {
  return `${BAND_WORD[m.depthBand]} · ${UNDERTONE_LABELS[m.undertone]} · ${FINISH_LABELS[m.finish]}`;
}
