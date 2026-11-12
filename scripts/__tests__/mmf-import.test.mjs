import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, truncate } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../import-mmf.mjs';
import { prepareMmfImport, applyMmfImport, ATTRIBUTION, LICENCE_URL } from '../lib/mmf-import.mjs';

const shade = { shade:'102 Fair Porcelain',depth:1.5,undertone:'olive',depthBasis:'hand-scored',
  depthMethod:'Placed individually on the site scale.',undertoneBasis:'site-assigned classification',
  formulaScope:'Catalog line only. Check the bottle.',sourceRecord:'https://matchmyfoundation.com/data/shade-sources/#test' };
const dataset = (rows=[shade]) => ({generated:'2026-11-10',license:'CC-BY-4.0',
  brands:[{brand:'Maybelline Fit Me',shades:rows}]});
const prepare = value => prepareMmfImport(Buffer.from(JSON.stringify(value)));

test('imports native decimal estimates and explicit line identity, never measured colour or model scores', () => {
  const result=prepare(dataset([{...shade,hex_illustrative:'#aa9988',lab_l:60,match_percent:99}]));
  assert.equal(result.rows.length,1);
  assert.equal(result.rows[0].native_depth,1.5);
  assert.equal(result.rows[0].native_undertone,'olive');
  assert.equal(result.rows[0].brand,'Maybelline');
  assert.equal(result.rows[0].product_line,'Fit Me');
  assert.equal(result.rows[0].source_brand_line,'Maybelline Fit Me');
  assert.equal(result.rows[0].shade_name,shade.shade);
  assert.equal(result.rows[0].depth_confidence,'D');
  assert.equal(result.rows[0].undertone_confidence,'D');
  assert.equal(result.rows[0].lab_status,'unmeasured');
  assert.equal(result.rows[0].status,'unverified');
  assert.equal(result.rows[0].formula_scope,shade.formulaScope);
  assert.equal(result.batch.attribution,ATTRIBUTION);
  assert.equal(result.batch.licence_url,LICENCE_URL);
  for (const key of ['hex_illustrative','lab_l','match_percent','accuracy','depth_band','base_undertone']) {
    assert.equal(key in result.rows[0],false);
  }
});

test('rejects missing/non-numeric/out-of-range depth, invalid undertone, unknown lines, unsafe URLs and duplicate identities', () => {
  const result=prepare(dataset([shade,{...shade,shade:'bad-depth',depth:'3'},
    {...shade,shade:'bad-undertone',undertone:'gold'}, {...shade,shade:'bad-range',depth:11},
    {...shade,shade:'bad-url',sourceRecord:'https://example.com/fake'},shade]));
  assert.equal(result.rows.length,1);
  assert.equal(result.rejected.length,5);
  assert.equal(prepare({...dataset(),brands:[{brand:'Unknown line',shades:[shade]}]}).rejected.length,1);
  assert.throws(()=>prepare({...dataset(),license:'proprietary'}),/licence/);
  assert.throws(()=>prepareMmfImport(Buffer.from('{')),/JSON/);
});

test('identity is stable across ordering; estimate changes never alter identity or invent a formula', () => {
  const a=prepare(dataset()).rows[0];
  const b=prepare(dataset([{...shade,depth:2}])).rows[0];
  assert.equal(a.source_key,b.source_key);
  assert.equal('formula_version' in a,false);
  assert.notEqual(prepare(dataset()).batch.source_sha256,prepare(dataset([{...shade,depth:2}])).batch.source_sha256);
});

test('operator transport sends only the validated batch to one service-only RPC and sanitizes errors', async () => {
  const calls=[];
  const batch=prepare(dataset());
  const result=await applyMmfImport(batch,{url:'http://127.0.0.1:54321',serviceKey:'test-only-key',fetch:async (url,init)=>{
    calls.push({url,init});return new Response(JSON.stringify({imported:1,protected:0}),{status:200});
  }});
  assert.equal(result.imported,1);
  assert.equal(calls[0].url,'http://127.0.0.1:54321/rest/v1/rpc/catalog_import_mmf');
  assert.deepEqual(JSON.parse(calls[0].init.body),{p_batch:batch.batch,p_rows:batch.rows});
  await assert.rejects(()=>applyMmfImport(batch,{url:'http://example.com',serviceKey:'secret',fetch:()=>{throw Error('called');}}),/configuration/);
  await assert.rejects(()=>applyMmfImport(batch,{url:'http://localhost:54321',serviceKey:'secret',fetch:async()=>new Response('secret',{status:500})}),/MMF import failed/);
});

test('CLI is dry-run by default and needs explicit apply configuration', async () => {
  const directory=await mkdtemp(join(tmpdir(),'mmf-test-'));
  try {
    const path=join(directory,'input.json');
    await writeFile(path,JSON.stringify(dataset()));
    const result=await run([path],{});
    assert.equal(result.dryRun,true);
    assert.equal(result.accepted,1);
    const cli = new URL('../import-mmf.mjs',import.meta.url).pathname;
    assert.equal(JSON.parse(execFileSync(process.execPath,[cli,path],{encoding:'utf8'})).accepted,1);
    assert.throws(()=>execFileSync(process.execPath,[cli],{stdio:'pipe'}),/Command failed/);
    await assert.rejects(()=>run([path,'--apply'],{}),/SUPABASE_SERVICE_ROLE_KEY/);
    await assert.rejects(()=>run([path,'--unknown'],{}),/Usage/);
    const previousFetch=globalThis.fetch;
    try {
      globalThis.fetch=async()=>new Response(JSON.stringify({imported:1,protected:0}));
      assert.equal((await run([path,'--apply'],{SUPABASE_URL:'http://localhost:54321',SUPABASE_SERVICE_ROLE_KEY:'test-only'})).imported,1);
    } finally { globalThis.fetch=previousFetch; }
    await truncate(path,20*1024*1024+1);
    await assert.rejects(()=>run([path],{}),/exceeds 20 MB/);
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('source wording is retained exactly instead of destructively normalizing shade names',()=>{
  const result=prepare(dataset([{...shade,shade:' 102 Fair Porcelain ',formulaScope:' line only '}])).rows[0];
  assert.equal(result.shade_name,' 102 Fair Porcelain ');
  assert.equal(result.formula_scope,' line only ');
});
