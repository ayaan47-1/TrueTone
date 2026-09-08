// src/content/makeup-vocab.ts
// Additive makeup-domain vocabulary (CLAUDE.md §1). This file is the single source of
// truth for the makeup shade-match feature's descriptors: goals, coverage, skips,
// finishes, undertones, product categories, and the fragments that build fit reasons.
//
// It intentionally does NOT touch the FROZEN src/content/cosmetic-vocab.ts. That file's
// APPROVED_LABELS is the closed vocabulary the on-device SKIN read may emit; makeup
// descriptors are a different (cosmetic-only) domain and must never widen it.
//
// Compliance rule for everything here: every user-facing string MUST be free of the
// disease/diagnostic blocklist (findDiseaseTerms() must return []). We describe how a
// product LOOKS / FEELS and how it fits a shade — never skin health, never a condition.

// --- Goals (multi-select; feeds A's preferences + Setup1) --------------------------------
export const GOALS = [
  'even_base',
  'natural_glow',
  'defined_eyes',
  'good_lip',
  'all_day_wear',
  'five_minute_face',
] as const;
export type Goal = (typeof GOALS)[number];

export const GOAL_LABELS: Record<Goal, string> = {
  even_base: 'Even base',
  natural_glow: 'Natural glow',
  defined_eyes: 'Defined eyes',
  good_lip: 'A good lip',
  all_day_wear: 'All-day wear',
  five_minute_face: 'Five-minute face',
};

// --- Coverage (single-select) ------------------------------------------------------------
export const COVERAGES = ['light', 'everyday', 'glam'] as const;
export type Coverage = (typeof COVERAGES)[number];

export const COVERAGE_LABELS: Record<Coverage, string> = {
  light: 'Light',
  everyday: 'Everyday',
  glam: 'Glam',
};

// --- Skips (multi-select attribute filters) ----------------------------------------------
// Per god ruling (2026-08-26): 'fragrance' & 'full_coverage' persist as structured prefs
// but carry NO scoring adjustment this phase — they are optional attribute filters only.
export const SKIPS = ['fragrance', 'heavy_shimmer', 'full_coverage', 'drying_matte'] as const;
export type Skip = (typeof SKIPS)[number];

export const SKIP_LABELS: Record<Skip, string> = {
  fragrance: 'Fragrance',
  heavy_shimmer: 'Heavy shimmer',
  full_coverage: 'Full coverage',
  drying_matte: 'Drying matte',
};

// --- Finish (product attribute) ----------------------------------------------------------
export const FINISHES = ['sheer', 'natural', 'satin', 'dewy', 'matte', 'glam'] as const;
export type Finish = (typeof FINISHES)[number];

export const FINISH_LABELS: Record<Finish, string> = {
  sheer: 'Sheer',
  natural: 'Natural',
  satin: 'Satin',
  dewy: 'Dewy',
  matte: 'Matte',
  glam: 'Glam',
};

// --- Undertone (shade attribute; warm/foundation tones are DATA, not brand) ---------------
export const UNDERTONES = ['warm', 'cool', 'neutral', 'olive'] as const;
export type Undertone = (typeof UNDERTONES)[number];

export const UNDERTONE_LABELS: Record<Undertone, string> = {
  warm: 'Warm',
  cool: 'Cool',
  neutral: 'Neutral',
  olive: 'Olive',
};

// --- Product category (drives the Shop filter tabs; 'prep' = quieter skincare shelf) ------
export const PRODUCT_CATEGORIES = ['face', 'eyes', 'lips', 'prep'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  face: 'Face',
  eyes: 'Eyes',
  lips: 'Lips',
  prep: 'Prep & skincare',
};

// --- Shop filter tabs (All / Face / Eyes / Lips) -----------------------------------------
export const FILTERS = ['all', 'face', 'eyes', 'lips'] as const;
export type Filter = (typeof FILTERS)[number];

export const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  face: 'Face',
  eyes: 'Eyes',
  lips: 'Lips',
};

// Badge shown on the top-scoring product per person AND per filter.
export const BEST_MATCH_BADGE = 'Best match';

// Every makeup-domain string that reaches the UI, gathered for the compliance test.
// (Fit-reason fragments live in ../features/match/fit-reason.ts and are checked there.)
export const MAKEUP_APPROVED_LABELS: readonly string[] = [
  ...Object.values(GOAL_LABELS),
  ...Object.values(COVERAGE_LABELS),
  ...Object.values(SKIP_LABELS),
  ...Object.values(FINISH_LABELS),
  ...Object.values(UNDERTONE_LABELS),
  ...Object.values(CATEGORY_LABELS),
  ...Object.values(FILTER_LABELS),
  BEST_MATCH_BADGE,
];
