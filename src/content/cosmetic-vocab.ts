// src/content/cosmetic-vocab.ts
// The ONLY descriptors the read may emit (CLAUDE.md §1). Single source of truth
// for the stub, the post-filter, and the UI — they must never drift apart.

export const DIMENSIONS = [
  'hydration', 'oiliness', 'texture', 'pores',
  'darkSpots', 'redness', 'fineLines', 'darkCircles',
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const SKIN_TYPE_FEELS = ['dry', 'oily', 'combination', 'sensitive'] as const;
export type SkinTypeFeel = (typeof SKIN_TYPE_FEELS)[number];

// Ordered low → high value (0 → 1). Placeholder copy pending IL counsel review.
export const BAND_LABELS: Record<Dimension, readonly [string, string, string]> = {
  hydration: ['Looks dehydrated', 'Balanced', 'Looks well-hydrated'],
  oiliness: ['Looks dry', 'Balanced', 'Looks oily'],
  texture: ['Looks smooth', 'Average', 'Looks uneven'],
  pores: ['Barely visible', 'Average', 'More visible'],
  darkSpots: ['Minimal', 'Some', 'More noticeable'],
  redness: ['Minimal', 'Some', 'More noticeable'],
  fineLines: ['Minimal', 'Some', 'More noticeable'],
  darkCircles: ['Minimal', 'Some', 'More noticeable'],
};

export const SKIN_TYPE_LABELS: Record<SkinTypeFeel, string> = {
  dry: 'Dry', oily: 'Oily', combination: 'Combination', sensitive: 'Sensitive-feeling',
};

// Disease / diagnostic terms that must NEVER appear in user-facing output (CLAUDE.md §1).
export const DISEASE_BLOCKLIST = [
  'acne', 'rosacea', 'eczema', 'melasma', 'dermatitis', 'psoriasis',
  'cancer', 'melanoma', 'carcinoma', 'lesion', 'tumor', 'infection',
  'diagnosis', 'disease', 'condition',
] as const;

export const APPROVED_LABELS: string[] = [
  ...Object.values(BAND_LABELS).flat(),
  ...Object.values(SKIN_TYPE_LABELS),
];

export const SCORE_COLUMNS: Record<Dimension, string> = {
  hydration: 'score_hydration', oiliness: 'score_oiliness',
  texture: 'score_texture', pores: 'score_pores',
  darkSpots: 'score_dark_spots', redness: 'score_redness',
  fineLines: 'score_fine_lines', darkCircles: 'score_dark_circles',
};
