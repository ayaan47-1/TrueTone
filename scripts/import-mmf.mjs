import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { prepareMmfImport, applyMmfImport } from './lib/mmf-import.mjs';

export async function run(args, env = process.env) {
  const [file,mode,...extra] = args;
  if (!file || (mode && mode !== '--apply') || extra.length) throw new Error('Usage: node scripts/import-mmf.mjs <foundation-shades.json> [--apply]');
  if ((await stat(file)).size > 20 * 1024 * 1024) throw new Error('MMF file exceeds 20 MB');
  const prepared = prepareMmfImport(await readFile(file));
  const summary = {accepted:prepared.rows.length,rejected:prepared.rejected,dataset_version:prepared.batch.dataset_version,source_sha256:prepared.batch.source_sha256};
  if (mode !== '--apply') return {...summary,dryRun:true};
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Import requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the operator shell');
  return {...summary,...await applyMmfImport(prepared,{url:env.SUPABASE_URL,serviceKey:env.SUPABASE_SERVICE_ROLE_KEY})};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).then(result=>process.stdout.write(`${JSON.stringify(result,null,2)}\n`)).catch(error=>{
    // A fixed error avoids disclosing response bodies, local paths or credentials.
    process.stderr.write(`${error instanceof Error && /^(Usage:|MMF file|Import requires)/.test(error.message) ? error.message : 'MMF import failed; check the source file and operator configuration.'}\n`);
    process.exitCode=1;
  });
}
