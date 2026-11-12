import { createHash } from 'node:crypto';
import { z } from 'zod';

export const LICENCE_URL = 'https://creativecommons.org/licenses/by/4.0/';
export const ATTRIBUTION = 'Match My Foundation (2026). Cross-brand foundation shade dataset: 410 shades across 13 lines, with 4920 computed cross-brand matches. https://matchmyfoundation.com/data/ (CC BY 4.0)';
export const CHANGE_NOTICE = "Adapted by TrueTone from Match My Foundation's 2026 cross-brand foundation shade dataset. Changes: mapped source depth and undertone to TrueTone native fields; split catalogue-line labels into brand and product-line fields; retained source provenance; and excluded illustrative colour and computed match scores from measured-colour fields. Retrieved 2026-11-12. Licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/. Estimates remain unverified tier D, without inferred formula identities or normalized colour coordinates.";

const lines = new Map([
  ['Maybelline Fit Me',['Maybelline','Fit Me']],
  ['Maybelline SuperStay',['Maybelline','SuperStay']],
  ["L'Oréal True Match",["L'Oréal",'True Match']],
  ['NARS Sheer Glow',['NARS','Sheer Glow']],
  ['MAC Studio Fix Fluid',['MAC','Studio Fix Fluid']],
  ['Estée Lauder Double Wear',['Estée Lauder','Double Wear']],
  ["Fenty Pro Filt'r",['Fenty',"Pro Filt'r"]],
  ['Charlotte Tilbury Airbrush',['Charlotte Tilbury','Airbrush']],
  ['Make Up For Ever HD Skin',['Make Up For Ever','HD Skin']],
  ['Rare Beauty Liquid Touch',['Rare Beauty','Liquid Touch']],
  ['Giorgio Armani Luminous Silk',['Giorgio Armani','Luminous Silk']],
  ['Too Faced Born This Way',['Too Faced','Born This Way']],
  ['Revlon ColorStay',['Revlon','ColorStay']],
]);
const text = z.string().min(1).max(2000).refine(value => value.trim().length > 0);
const sourceUrl = z.string().url().refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && url.hostname === 'matchmyfoundation.com' && !url.username && !url.password;
});
const shadeSchema = z.object({
  shade:text, depth:z.number().finite().min(1).max(10), undertone:z.enum(['cool','neutral','warm','olive']),
  depthBasis:text, depthMethod:text, undertoneBasis:text, formulaScope:text, sourceRecord:sourceUrl,
});
const datasetSchema = z.object({
  license:z.literal('CC-BY-4.0'), generated:z.iso.date(),
  brands:z.array(z.object({brand:text,shades:z.array(z.unknown())})).max(100),
});
const digest = value => createHash('sha256').update(value).digest('hex');

/** Explicit allowlist: illustration, computed scores and extra source fields never cross this boundary. */
export function prepareMmfImport(bytes) {
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error('MMF file exceeds 20 MB');
  let raw;
  try { raw = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('Invalid MMF JSON'); }
  if (raw?.license !== 'CC-BY-4.0') throw new Error('Unsupported MMF licence');
  const data = datasetSchema.parse(raw);
  const rows = [];
  const rejected = [];
  const seen = new Set();
  for (const line of data.brands) {
    const identity = lines.get(line.brand);
    for (const [index,rawShade] of line.shades.entries()) {
      const parsed = shadeSchema.safeParse(rawShade);
      if (!identity || !parsed.success) {
        rejected.push({line:line.brand,index,reason:identity ? 'invalid_source_fields' : 'unknown_catalogue_line'});
        continue;
      }
      const shade = parsed.data;
      const sourceKey = digest(JSON.stringify([line.brand,shade.shade]));
      if (seen.has(sourceKey)) {
        rejected.push({line:line.brand,index,reason:'duplicate_source_identity'});
        continue;
      }
      seen.add(sourceKey);
      rows.push({
        source_key:sourceKey, source_brand_line:line.brand, brand:identity[0],product_line:identity[1],
        shade_name:shade.shade,native_depth:shade.depth,native_undertone:shade.undertone,
        depth_basis:shade.depthBasis,depth_method:shade.depthMethod,undertone_basis:shade.undertoneBasis,
        formula_scope:shade.formulaScope,source_record:shade.sourceRecord,
        depth_confidence:'D',undertone_confidence:'D',lab_status:'unmeasured',status:'unverified',
      });
    }
  }
  return {batch:{dataset_version:data.generated,retrieved_at:'2026-11-12',source_sha256:digest(bytes),
    source_url:'https://matchmyfoundation.com/data/',attribution:ATTRIBUTION,licence_url:LICENCE_URL,change_notice:CHANGE_NOTICE}, rows,rejected};
}

export async function applyMmfImport(prepared, {url,serviceKey,fetch:send = globalThis.fetch}) {
  let target;
  try { target = new URL(url); } catch { throw new Error('Invalid import configuration'); }
  const local = ['localhost','127.0.0.1','[::1]'].includes(target.hostname);
  if (!serviceKey || target.username || target.password || target.search || target.hash || target.pathname !== '/' ||
      (local ? !['http:','https:'].includes(target.protocol) : target.protocol !== 'https:' || !target.hostname.endsWith('.supabase.co'))) {
    throw new Error('Invalid import configuration');
  }
  let response;
  try {
    response = await send(`${target.origin}/rest/v1/rpc/catalog_import_mmf`, {
      method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({p_batch:prepared.batch,p_rows:prepared.rows}),
    });
  } catch { throw new Error('MMF import failed'); }
  if (!response.ok) throw new Error('MMF import failed');
  return z.object({imported:z.number().int().nonnegative(),protected:z.number().int().nonnegative()}).parse(await response.json());
}
