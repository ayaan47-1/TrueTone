// Authored, counsel-reviewable catalog of APPROVED, BRAND-NEUTRAL cosmetic categories + habits.
// Every string here is user-facing and MUST contain no disease/diagnostic term (enforced by test).
// Placeholder copy pending IL counsel review — same posture as cosmetic-vocab BAND_LABELS.

export type CategoryKey =
  | 'gentle_cleanser' | 'hydrating_serum' | 'oil_control' | 'gentle_exfoliant'
  | 'brightening_serum' | 'soothing_moisturizer' | 'daily_spf' | 'eye_care' | 'barrier_moisturizer';

export interface LibraryEntry {
  key: CategoryKey;
  category: string;
  habit: string;
  rationale: string;
  slot: 'am' | 'pm' | 'both';
}

export const SKINCARE_LIBRARY: Record<CategoryKey, LibraryEntry> = {
  gentle_cleanser: {
    key: 'gentle_cleanser',
    category: 'a gentle hydrating cleanser',
    habit: 'cleanse with lukewarm water, then pat dry',
    rationale: 'a mild base step that suits most skin',
    slot: 'both',
  },
  hydrating_serum: {
    key: 'hydrating_serum',
    category: 'a hydrating serum (e.g. hyaluronic acid type)',
    habit: 'apply to slightly damp skin',
    rationale: 'for skin that looks dehydrated',
    slot: 'both',
  },
  oil_control: {
    key: 'oil_control',
    category: 'a lightweight, oil-free moisturizer',
    habit: 'use a small amount, focusing on drier areas',
    rationale: 'for skin that looks oily',
    slot: 'both',
  },
  gentle_exfoliant: {
    key: 'gentle_exfoliant',
    category: 'a gentle exfoliant (low-strength)',
    habit: 'start once or twice a week, not daily',
    rationale: 'for the look of uneven texture or more visible pores',
    slot: 'pm',
  },
  brightening_serum: {
    key: 'brightening_serum',
    category: 'a brightening serum (e.g. vitamin C type)',
    habit: 'apply in the morning before moisturizer',
    rationale: 'for the appearance of dark spots',
    slot: 'am',
  },
  soothing_moisturizer: {
    key: 'soothing_moisturizer',
    category: 'a soothing, fragrance-free moisturizer',
    habit: 'apply while skin is still slightly damp',
    rationale: 'for skin that looks red or feels sensitive',
    slot: 'both',
  },
  daily_spf: {
    key: 'daily_spf',
    category: 'a broad-spectrum SPF 30+ sunscreen',
    habit: 'apply every morning as the last step, reapply if outdoors',
    rationale: 'a daily habit that supports an even-looking tone over time',
    slot: 'am',
  },
  eye_care: {
    key: 'eye_care',
    category: 'a hydrating eye cream',
    habit: 'gently tap a small amount around the eye area',
    rationale: 'for the appearance of dark circles',
    slot: 'both',
  },
  barrier_moisturizer: {
    key: 'barrier_moisturizer',
    category: 'a richer moisturizer',
    habit: 'apply as the final night-time step',
    rationale: 'for the look of fine lines and dryness',
    slot: 'pm',
  },
};

export const SKINCARE_NOTES: Record<string, string> = {
  dry: 'Your skin reads on the drier side — lean into hydration and gentle, fragrance-free products.',
  oily: 'Your skin reads oilier — lightweight, oil-free textures tend to feel more comfortable.',
  combination: 'Your skin reads as combination — you can tailor richness by area (lighter on the T-zone).',
  sensitive: 'Your skin reads sensitive-feeling — patch-test new products and keep things fragrance-free.',
};
