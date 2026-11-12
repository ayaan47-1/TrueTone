import { z } from 'zod';
import { FINISHES } from '../../content/makeup-vocab.ts';
import type { Product } from '../match/match-types';

const eligibleTier = z.enum(['M','B','C']);
const tier = z.enum(['M','B','C','D','X']);
const rowSchema = z.object({
  variant_gid: z.string().regex(/^gid:\/\/shopify\/ProductVariant\/\d+$/),
  product_gid: z.string().regex(/^gid:\/\/shopify\/Product\/\d+$/),
  label_id: z.uuid(), vendor: z.string().min(1), shade_name: z.string().min(1),
  formula_key: z.string().min(1), formula_version: z.string().min(1),
  price: z.number().finite().nonnegative(), currency: z.literal('USD'),
  depth_band: z.number().int().min(1).max(10), base_undertone: z.enum(['cool','neutral','warm']),
  brand_depth_rank: z.number().min(0).max(100).nullable(),
  undertone_modifiers: z.array(z.enum(['olive','golden/yellow','peach','pink/rosy','red'])),
  depth_confidence: eligibleTier, undertone_confidence: eligibleTier, rank_confidence: tier,
  modifier_confidence: z.record(z.string(),eligibleTier),
  finish: z.string().nullable(), coverage: z.string().nullable(),
  lab_status: z.enum(['measured','unmeasured']), lab_l: z.number().min(0).max(100).nullable(),
  lab_a: z.number().min(-128).max(127).nullable(), lab_b: z.number().min(-128).max(127).nullable(),
}).refine(row => {
  const none = row.lab_l === null && row.lab_a === null && row.lab_b === null;
  const complete = row.lab_l !== null && row.lab_a !== null && row.lab_b !== null;
  return (none || complete && row.lab_status === 'measured') &&
    (row.depth_confidence !== 'M' && row.undertone_confidence !== 'M' || complete) &&
    (row.brand_depth_rank === null || ['M','B','C'].includes(row.rank_confidence)) &&
    row.undertone_modifiers.every(modifier => modifier in row.modifier_confidence) &&
    Object.keys(row.modifier_confidence).every(modifier => row.undertone_modifiers.some(value => value === modifier));
}, 'incomplete catalogue evidence');

export interface CatalogueEvidence {
  productGid: string; labelId: string; vendor: string; formulaKey: string; formulaVersion: string;
  currency: 'USD'; depthConfidence: 'M'|'B'|'C'; undertoneConfidence: 'M'|'B'|'C';
  undertoneModifiers: string[]; brandDepthRank: number | null; coverage: string | null;
  lab: { l: number; a: number; b: number } | null;
}

export const CATALOGUE_COLUMNS = 'variant_gid,product_gid,vendor,shade_name,formula_key,formula_version,price,currency,label_id,depth_band,brand_depth_rank,base_undertone,undertone_modifiers,depth_confidence,rank_confidence,undertone_confidence,modifier_confidence,finish,coverage,lab_status,lab_l,lab_a,lab_b';

export function mapCatalogueRow(value: unknown): Product {
  const row = rowSchema.parse(value);
  const finish = z.enum(FINISHES).safeParse(row.finish?.toLowerCase());
  return {
    id: row.variant_gid, name: `${row.vendor} ${row.shade_name}`, category: 'face',
    shadeName: row.shade_name, shade: row.depth_band, undertone: row.base_undertone,
    finish: finish.success ? finish.data : 'unknown', hasShimmer: null, price: row.price,
    catalogue: { productGid: row.product_gid, labelId: row.label_id, vendor: row.vendor,
      formulaKey: row.formula_key, formulaVersion: row.formula_version, currency: row.currency,
      depthConfidence: row.depth_confidence, undertoneConfidence: row.undertone_confidence,
      undertoneModifiers: row.undertone_modifiers, brandDepthRank: row.brand_depth_rank, coverage: row.coverage,
      lab: row.lab_l !== null && row.lab_a !== null && row.lab_b !== null ? { l: row.lab_l,a:row.lab_a,b:row.lab_b } : null },
  };
}

export function createCatalogueRepository(readPage: (from: number,to: number) => Promise<unknown[]>, pageSize = 500) {
  return { async list(): Promise<Product[]> {
    const products: Product[] = [];
    const seen = new Set<string>();
    for (let from = 0; ; from += pageSize) {
      const rows = await readPage(from,from + pageSize - 1);
      for (const row of rows) {
        const product = mapCatalogueRow(row);
        if (seen.has(product.id)) throw new Error('catalogue changed during pagination');
        seen.add(product.id);
        products.push(product);
      }
      if (rows.length < pageSize) return products;
    }
  } };
}
