// Fixed sentence templates: deviations → approved, appearance-only, relative phrasing.
// Every reachable output is asserted clean via findDiseaseTerms in the compliance fuzz
// (personal-copy-compliance.test.ts). Relative/within-user only — never absolute.
import { DIMENSIONS, type Dimension } from '../../content/cosmetic-vocab';
import { MAX_MESSAGES } from './types';
import type { DimensionDeviation, PersonalDeviation } from './types';

// Appearance-framed display names (spec §2.4). "Appearance of" phrasing on the
// dimensions that describe visible marks, matching the Result screen's sections.
const NAMES: Record<Dimension, string> = {
  hydration: 'Hydration look',
  oiliness: 'Oiliness',
  texture: 'Texture',
  pores: 'Pore visibility',
  darkSpots: 'The appearance of dark spots',
  redness: 'The appearance of redness',
  fineLines: 'The appearance of fine lines',
  darkCircles: 'The appearance of dark circles',
};

function sentence(dimension: Dimension, deviation: DimensionDeviation): string {
  const direction = deviation.status === 'above' ? 'up' : 'down';
  const base = `${NAMES[dimension]} is ${direction} compared to your usual`;
  if (deviation.favorable === true) return `${base} — looking settled.`;
  if (deviation.favorable === false) return `${base} — worth a gentle focus.`;
  return `${base}.`; // neutral (oiliness): no judgment either way
}

// Ordering: unfavorable → favorable → neutral; DIMENSIONS order within each group
// (Array.prototype.sort is stable). Capped at MAX_MESSAGES.
const GROUP_ORDER = (favorable: boolean | null): number =>
  favorable === false ? 0 : favorable === true ? 1 : 2;

export function personalCopy(deviation: PersonalDeviation): string[] {
  return DIMENSIONS
    .map((d) => ({ d, dev: deviation[d] }))
    .filter((x): x is { d: Dimension; dev: DimensionDeviation } =>
      x.dev != null && x.dev.status !== 'within',
    )
    .sort((a, b) => GROUP_ORDER(a.dev.favorable) - GROUP_ORDER(b.dev.favorable))
    .slice(0, MAX_MESSAGES)
    .map(({ d, dev }) => sentence(d, dev));
}
