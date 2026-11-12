// Operator-only Node CLI. Never import into the Expo application.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const fields = ['depth_band', 'brand_depth_rank', 'base_undertone', 'undertone_modifiers',
  'depth_confidence', 'rank_confidence', 'undertone_confidence', 'modifier_confidence',
  'native_depth', 'native_undertone', 'native_shade_code', 'native_richness',
  'original_brand_description', 'depth_source', 'undertone_source', 'source_url',
  'source_market', 'source_as_of', 'source_licence', 'source_attribution', 'parser_version',
  'mapping_version', 'model_version', 'reviewer_ids', 'finish', 'coverage'];
const modifiers = ['olive', 'golden/yellow', 'peach', 'pink/rosy', 'red'];
const usage = 'Usage: node scripts/catalog-label.mjs queue [limit=50] [offset=0] | show <variant_gid> | draft <review.json> | approve <review.json>';
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
// Same Unicode White_Space + U+200B/U+FEFF set as catalog_is_blank in migration 0037.
const provenanceNonempty = value => typeof value === 'string' &&
  /[^\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200B\u2028\u2029\u202F\u205F\u3000\uFEFF]/u.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function requireValue(condition, message) { if (!condition) throw new Error(message); }

export function prepareLabel(input, action) {
  requireValue(['draft', 'approve'].includes(action), usage);
  requireValue(object(input), 'Review must be an object');
  for (const key of ['variant_gid', 'formula_key', 'formula_version', 'shade_name']) {
    requireValue(nonempty(input[key]), `Missing ${key}`);
  }
  requireValue(Object.hasOwn(input, 'expected_label_id') &&
    (input.expected_label_id === null || nonempty(input.expected_label_id)), 'Missing expected_label_id; export with show first');
  requireValue(object(input.label), 'Missing label');
  const label = structuredClone(input.label);
  for (const [key, value] of Object.entries(label)) {
    requireValue(fields.includes(key), `Unsupported label field: ${key}`);
    if (!['depth_band', 'brand_depth_rank', 'undertone_modifiers', 'modifier_confidence', 'reviewer_ids'].includes(key)) {
      requireValue(value === null || typeof value === 'string', `Invalid ${key}`);
    }
  }
  requireValue(label.depth_band == null || Number.isInteger(label.depth_band) && label.depth_band >= 1 && label.depth_band <= 10, 'Invalid depth_band');
  requireValue(label.brand_depth_rank == null || typeof label.brand_depth_rank === 'number' && Number.isFinite(label.brand_depth_rank) && label.brand_depth_rank >= 0 && label.brand_depth_rank <= 100, 'Invalid brand_depth_rank');
  label.base_undertone ??= 'unknown';
  requireValue(['cool', 'neutral', 'warm', 'unknown'].includes(label.base_undertone), 'Invalid base_undertone');
  for (const field of ['depth_confidence', 'rank_confidence', 'undertone_confidence']) {
    label[field] ??= 'X';
    requireValue(['B', 'C', 'D', 'X'].includes(label[field]), `Invalid ${field}; M requires a separate instrument workflow`);
  }
  label.undertone_modifiers ??= []; label.modifier_confidence ??= {};
  requireValue(Array.isArray(label.undertone_modifiers) && object(label.modifier_confidence) &&
    new Set(label.undertone_modifiers).size === label.undertone_modifiers.length &&
    Object.keys(label.modifier_confidence).length === label.undertone_modifiers.length &&
    label.undertone_modifiers.every(m => modifiers.includes(m) && ['B', 'C', 'D', 'X'].includes(label.modifier_confidence[m])), 'Invalid modifiers or per-modifier confidence');
  requireValue(Array.isArray(label.reviewer_ids) && label.reviewer_ids.every(nonempty), 'Provide reviewer_ids');
  label.reviewer_ids = [...new Set(label.reviewer_ids.map(id => id.toLowerCase().replace(/\s/g, '')))];
  requireValue(label.reviewer_ids.length > 0, 'Provide reviewer_ids');
  if (label.source_as_of != null) {
    requireValue(/^\d{4}-\d{2}-\d{2}$/.test(label.source_as_of) &&
      !Number.isNaN(Date.parse(label.source_as_of)) && new Date(label.source_as_of).toISOString().slice(0, 10) === label.source_as_of, 'Invalid source_as_of');
  }
  if (action === 'approve') {
    const tiers = [label.depth_confidence, label.undertone_confidence,
      ...(label.brand_depth_rank == null ? [] : [label.rank_confidence]), ...Object.values(label.modifier_confidence)];
    requireValue(label.depth_band != null && label.base_undertone !== 'unknown' && tiers.every(t => ['B', 'C'].includes(t)), 'Incomplete or inferred evidence cannot receive approval');
    // The DB counts rank C even when the optional rank is absent.
    requireValue(![...tiers, label.rank_confidence].includes('C') || label.reviewer_ids.length >= 2, 'C evidence requires two distinct reviewers');
    for (const key of ['depth_source', 'undertone_source', 'source_url', 'source_market', 'source_as_of', 'parser_version']) {
      requireValue(provenanceNonempty(label[key]), `Approval requires ${key}`);
    }
  }
  return { variant_gid: input.variant_gid, expected_label_id: input.expected_label_id,
    formula_key: input.formula_key, formula_version: input.formula_version, shade_name: input.shade_name, label };
}

export async function run(args, request, load = path => readFile(path, 'utf8')) {
  const [command, value, offset = '0'] = args;
  if (command === 'queue' && args.length <= 3) {
    const limit = value ?? '50';
    requireValue(/^\d+$/.test(limit) && +limit >= 1 && +limit <= 1000, 'Queue limit must be 1–1000');
    requireValue(/^\d+$/.test(offset) && Number.isSafeInteger(+offset), 'Invalid queue offset');
    return request(`catalog_needs_label?select=*&order=variant_gid&limit=${limit}&offset=${offset}`);
  }
  if (command === 'show' && value && args.length === 2) {
    const filter = `variant_gid=eq.${encodeURIComponent(value)}`;
    const rows = await request(`catalog_needs_label?select=*&${filter}`);
    requireValue(rows.length === 1, 'Shade is no longer in the needs_label queue');
    const bindings = await request(`catalog_label_bindings?select=label_id&${filter}`);
    const id = bindings[0]?.label_id ?? null;
    const labels = id ? await request(`catalog_tone_labels?select=*&id=eq.${encodeURIComponent(id)}`) : [];
    const current = labels[0] ?? {};
    requireValue(!['approved', 'retired'].includes(current.status), 'Existing immutable evidence requires the separate instrument/revision workflow');
    return { variant_gid: value, expected_label_id: id, formula_key: rows[0].formula_key,
      formula_version: rows[0].formula_version, shade_name: rows[0].shade_name,
      label: Object.fromEntries(fields.map(key => [key, current[key] ??
        (key === 'reviewer_ids' || key === 'undertone_modifiers' ? [] : key === 'modifier_confidence' ? {} :
          key.endsWith('_confidence') ? 'X' : key === 'base_undertone' ? 'unknown' : null)])) };
  }
  if (['draft', 'approve'].includes(command) && value && args.length === 2) {
    const review = prepareLabel(JSON.parse(await load(value)), command);
    return request('rpc/catalog_submit_label', { method: 'POST', body: { p_review: review, p_action: command } });
  }
  throw new Error(usage);
}

export function createRequest(env, fetcher = fetch) {
  requireValue(nonempty(env.SUPABASE_URL) && nonempty(env.SUPABASE_SERVICE_ROLE_KEY), 'Set server-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const url = new URL(env.SUPABASE_URL);
  requireValue(url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Use HTTPS or local loopback HTTP');
  requireValue(!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, 'SUPABASE_URL must be a project origin');
  return async (path, options = {}) => {
    let response;
    try {
      response = await fetcher(`${url.origin}/rest/v1/${path}`, {
        method: options.method ?? 'GET', redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });
    } catch { throw new Error('Catalogue request failed; check connection. No automatic write retry.'); }
    // Do not echo remote bodies, which can contain operator data or credentials.
    requireValue(response.ok, `Catalogue request rejected (HTTP ${response.status}); re-export with show if stale, otherwise check evidence and database constraints`);
    return response.json();
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (!args.length || args[0] === '--help') console.log(usage);
    else console.log(JSON.stringify(await run(args, createRequest(process.env)), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
