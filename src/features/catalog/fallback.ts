/** Product attributes only. This module never accepts or transmits a scan or profile. */
export type EvidenceTier = 'M' | 'B' | 'C' | 'D' | 'X';
export type BaseUndertone = 'cool' | 'neutral' | 'warm' | 'unknown';

export interface ShadeCandidate {
  variantId: string;
  formulaKey: string;
  formulaVersion: string;
  published: boolean;
  inStock: boolean;
  deleted: boolean;
  approved: boolean;
  depthBand: number;
  baseUndertone: BaseUndertone;
  depthConfidence: EvidenceTier;
  undertoneConfidence: EvidenceTier;
  finish: string;
  coverage: string;
  price: number;
  currency: string;
}

export interface CataloguePreferences {
  finish: string;
  coverage: string;
  budget: number;
  currency: string;
}

export type StockChoice =
  | { kind: 'available'; variantId: string }
  | { kind: 'alternatives'; unavailableVariantId: string; alternatives: ShadeCandidate[] }
  | { kind: 'none'; unavailableVariantId: string };

const tierRank = { M: 0, B: 1, C: 2, D: 3, X: 4 };

function verified(candidate: ShadeCandidate): boolean {
  return candidate.approved && tierRank[candidate.depthConfidence] <= 2 &&
    tierRank[candidate.undertoneConfidence] <= 2 && candidate.baseUndertone !== 'unknown';
}

function sellable(candidate: ShadeCandidate): boolean {
  return candidate.published && candidate.inStock && !candidate.deleted;
}

/** Caller supplies a validated suitability limit; no global cross-brand ordinal is invented. */
export function chooseAvailableShades({ best, candidates, preferences, maxDepthDifference }: {
  best: ShadeCandidate;
  candidates: readonly ShadeCandidate[];
  preferences: CataloguePreferences | null;
  maxDepthDifference: number;
}): StockChoice {
  const none: StockChoice = { kind: 'none', unavailableVariantId: best.variantId };
  if (!verified(best)) return none;
  if (sellable(best)) return { kind: 'available', variantId: best.variantId };
  if (!preferences || !Number.isFinite(maxDepthDifference) || maxDepthDifference < 0) return none;

  const sameFormula = (row: ShadeCandidate) =>
    row.formulaKey === best.formulaKey && row.formulaVersion === best.formulaVersion;
  const alternatives = candidates.filter(row => row.variantId !== best.variantId &&
    verified(row) && sellable(row) &&
    Math.abs(row.depthBand - best.depthBand) <= maxDepthDifference &&
    row.baseUndertone === best.baseUndertone &&
    row.finish === preferences.finish && row.coverage === preferences.coverage &&
    row.currency === preferences.currency && row.price <= preferences.budget
  ).sort((a, b) => Number(sameFormula(b)) - Number(sameFormula(a)) ||
    Math.abs(a.depthBand - best.depthBand) - Math.abs(b.depthBand - best.depthBand) ||
    tierRank[a.depthConfidence] + tierRank[a.undertoneConfidence] -
      tierRank[b.depthConfidence] - tierRank[b.undertoneConfidence] ||
    (a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0));

  return alternatives.length ? { kind: 'alternatives', unavailableVariantId: best.variantId, alternatives } : none;
}
