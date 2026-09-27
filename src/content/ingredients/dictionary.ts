// src/content/ingredients/dictionary.ts
// Starter ingredient dictionary for P1 search (design §2.3, §3.2). Names only: no product data,
// no clash classes yet (P2/P3). Sources: EU CosIng INCI names; EU Annex III fragrance allergens.
// Hand-curated, pending the dermatologist audit of the lists.
export type IngredientId = string;

export interface Ingredient {
  readonly id: IngredientId;
  readonly inci: string;
  readonly aliases: readonly string[];
  readonly tradeNames: readonly string[];
}

/** Dictionary + groups version, same format as POLICY_VERSION. Saved with each profile. */
export const TAXONOMY_VERSION = '2026-09-27.1';

const ing = (id: string, inci: string, aliases: string[] = [], tradeNames: string[] = []): Ingredient =>
  ({ id, inci, aliases, tradeNames });

export const INGREDIENTS: readonly Ingredient[] = [
  // Fragrance components (EU Annex III subset)
  ing('linalool', 'Linalool'),
  ing('limonene', 'Limonene', ['d-limonene']),
  ing('citronellol', 'Citronellol'),
  ing('geraniol', 'Geraniol'),
  ing('eugenol', 'Eugenol'),
  ing('coumarin', 'Coumarin'),
  ing('cinnamal', 'Cinnamal', ['cinnamaldehyde']),
  ing('hydroxycitronellal', 'Hydroxycitronellal'),
  ing('benzyl_salicylate', 'Benzyl Salicylate'),
  ing('citral', 'Citral'),
  // Isothiazolinones
  ing('methylisothiazolinone', 'Methylisothiazolinone', ['mit', 'mi'], ['Kathon CG']),
  ing('methylchloroisothiazolinone', 'Methylchloroisothiazolinone', ['mci', 'cmit'], ['Kathon CG']),
  // Formaldehyde releasers
  ing('dmdm_hydantoin', 'DMDM Hydantoin', [], ['Glydant']),
  ing('imidazolidinyl_urea', 'Imidazolidinyl Urea', [], ['Germall 115']),
  ing('diazolidinyl_urea', 'Diazolidinyl Urea', [], ['Germall II']),
  ing('quaternium_15', 'Quaternium-15'),
  ing('bronopol', '2-Bromo-2-Nitropropane-1,3-Diol', ['bronopol']),
  ing('sodium_hydroxymethylglycinate', 'Sodium Hydroxymethylglycinate'),
  // Parabens
  ing('methylparaben', 'Methylparaben'),
  ing('ethylparaben', 'Ethylparaben'),
  ing('propylparaben', 'Propylparaben'),
  ing('butylparaben', 'Butylparaben'),
  // Hair-dye
  ing('p_phenylenediamine', 'p-Phenylenediamine', ['ppd', 'para-phenylenediamine']),
  // Sulfates
  ing('sodium_lauryl_sulfate', 'Sodium Lauryl Sulfate', ['sls']),
  ing('sodium_laureth_sulfate', 'Sodium Laureth Sulfate', ['sles']),
  ing('ammonium_lauryl_sulfate', 'Ammonium Lauryl Sulfate', ['als']),
  // Commonly listed plant extracts and oils
  ing('tea_tree_oil', 'Melaleuca Alternifolia Leaf Oil', ['tea tree oil']),
  ing('lavender_oil', 'Lavandula Angustifolia Oil', ['lavender oil']),
  ing('sweet_almond_oil', 'Prunus Amygdalus Dulcis Oil', ['sweet almond oil']),
  ing('chamomile_extract', 'Chamomilla Recutita Flower Extract', ['chamomile extract']),
  ing('peppermint_oil', 'Mentha Piperita Oil', ['peppermint oil']),
  ing('ylang_ylang_oil', 'Cananga Odorata Flower Oil', ['ylang ylang oil']),
  // Other commonly searched names (not in a group)
  ing('lanolin', 'Lanolin', ['wool wax']),
  ing('propylene_glycol', 'Propylene Glycol'),
  ing('cocamidopropyl_betaine', 'Cocamidopropyl Betaine'),
];

const BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));

export function ingredientById(id: IngredientId): Ingredient | undefined {
  return BY_ID.get(id);
}
