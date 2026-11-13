import type { Product } from '../match/match-types';
import { chooseAvailableShades, type CataloguePreferences, type ShadeCandidate } from './fallback.ts';

function candidate(product: Product, inStock: boolean): ShadeCandidate | null {
  const evidence = product.catalogue;
  if (!evidence) return null;
  return { variantId: product.id, formulaKey:evidence.formulaKey, formulaVersion:evidence.formulaVersion,
    published:true,inStock,deleted:false,approved:true,depthBand:product.shade,baseUndertone:product.undertone === 'olive' ? 'unknown' : product.undertone,
    depthConfidence:evidence.depthConfidence,undertoneConfidence:evidence.undertoneConfidence,
    finish:product.finish,coverage:evidence.coverage ?? 'unknown',price:product.price,currency:evidence.currency };
}

export function availableAlternatives(best: Product, products: readonly Product[], preferences: CataloguePreferences | null, maxDepthDifference: number): Product[] {
  const reference = candidate(best,false);
  if (!reference || best.finish === 'unknown' || !best.catalogue?.coverage) return [];
  const candidates = products.flatMap(product => { const item = candidate(product,true); return item ? [item] : []; });
  const result = chooseAvailableShades({ best: reference,candidates,preferences,maxDepthDifference });
  if (result.kind !== 'alternatives') return [];
  const byId = new Map(products.map(product => [product.id,product]));
  return result.alternatives.flatMap(item => { const product = byId.get(item.variantId); return product ? [product] : []; });
}
