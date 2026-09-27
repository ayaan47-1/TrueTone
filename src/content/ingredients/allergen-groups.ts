// src/content/ingredients/allergen-groups.ts
// The brief's 10 selectable groups (design §2.3). A user picks a GROUP, so saved selections pick up
// new members automatically. Labels are copy-reviewed (allergen-copy.test.ts).
// Founder decision: latex and hair-dye PPD are referral-only — choosing them shows a see-a-doctor
// note (ALLERGEN_COPY.referralNote) and is NOT saved as a product flag.
import type { IngredientId } from './dictionary';

export type AllergenGroupId =
  | 'fragrance' | 'linalool' | 'limonene' | 'mit' | 'formaldehyde_releasers' | 'parabens'
  | 'latex' | 'ppd' | 'sulfates' | 'botanicals';

export interface AllergenGroup {
  readonly id: AllergenGroupId;
  readonly label: string;
  readonly members: readonly IngredientId[];
  /** Label tokens meaning "this group, contents undisclosed" (used from P2). */
  readonly umbrellaTokens: readonly string[];
  readonly referralOnly: boolean;
}

const FRAGRANCE_COMPONENTS = [
  'linalool', 'limonene', 'citronellol', 'geraniol', 'eugenol', 'coumarin', 'cinnamal',
  'hydroxycitronellal', 'benzyl_salicylate', 'citral',
];

export const ALLERGEN_GROUPS: readonly AllergenGroup[] = [
  { id: 'fragrance', label: 'Fragrance / parfum', members: FRAGRANCE_COMPONENTS,
    umbrellaTokens: ['parfum', 'fragrance', 'aroma', 'flavor'], referralOnly: false },
  { id: 'linalool', label: 'Linalool', members: ['linalool'], umbrellaTokens: [], referralOnly: false },
  { id: 'limonene', label: 'Limonene', members: ['limonene'], umbrellaTokens: [], referralOnly: false },
  { id: 'mit', label: 'Methylisothiazolinone (MIT)',
    members: ['methylisothiazolinone', 'methylchloroisothiazolinone'], umbrellaTokens: [], referralOnly: false },
  { id: 'formaldehyde_releasers', label: 'Formaldehyde releasers',
    members: ['dmdm_hydantoin', 'imidazolidinyl_urea', 'diazolidinyl_urea', 'quaternium_15', 'bronopol',
      'sodium_hydroxymethylglycinate'], umbrellaTokens: [], referralOnly: false },
  { id: 'parabens', label: 'Parabens',
    members: ['methylparaben', 'ethylparaben', 'propylparaben', 'butylparaben'], umbrellaTokens: [], referralOnly: false },
  { id: 'latex', label: 'Latex', members: [], umbrellaTokens: [], referralOnly: true },
  { id: 'ppd', label: 'Hair-dye PPD', members: ['p_phenylenediamine'], umbrellaTokens: [], referralOnly: true },
  { id: 'sulfates', label: 'Sulfates (SLS, SLES)',
    members: ['sodium_lauryl_sulfate', 'sodium_laureth_sulfate', 'ammonium_lauryl_sulfate'], umbrellaTokens: [], referralOnly: false },
  { id: 'botanicals', label: 'Commonly listed plant extracts and oils',
    members: ['tea_tree_oil', 'lavender_oil', 'sweet_almond_oil', 'chamomile_extract', 'peppermint_oil',
      'ylang_ylang_oil'], umbrellaTokens: [], referralOnly: false },
];

export const REFERRAL_GROUP_IDS: ReadonlySet<AllergenGroupId> = new Set(
  ALLERGEN_GROUPS.filter((g) => g.referralOnly).map((g) => g.id),
);

export function groupById(id: string): AllergenGroup | undefined {
  return ALLERGEN_GROUPS.find((g) => g.id === id);
}

export function isFlaggableGroup(id: string): id is AllergenGroupId {
  const g = groupById(id);
  return g !== undefined && !g.referralOnly;
}
