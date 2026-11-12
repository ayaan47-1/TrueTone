import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareLabel, run, createRequest } from '../catalog-label.mjs';
import { spawn } from 'node:child_process';

const input = () => ({ variant_gid: 'gid://shopify/ProductVariant/1', expected_label_id: null,
  formula_key: 'brand:formula', formula_version: '1', shade_name: 'Tan',
  label: { depth_band: 5, base_undertone: 'warm', native_depth: 'Tan', native_undertone: 'Golden',
    depth_confidence: 'C', undertone_confidence: 'B', rank_confidence: 'X',
    undertone_modifiers: ['olive'], modifier_confidence: { olive: 'C' },
    reviewer_ids: [' Alice Smith ', 'BOB'], depth_source: 'chart', undertone_source: 'brand',
    source_url: 'https://example.com/shades', source_market: 'US', source_as_of: '2026-11-01',
    parser_version: 'manual-1' } });

test('normalizes and deduplicates reviewer IDs without mutating input', () => {
  const data = input();
  assert.deepEqual(prepareLabel(data, 'approve').label.reviewer_ids, ['alicesmith', 'bob']);
  assert.equal(data.label.reviewer_ids[0], ' Alice Smith ');
});
test('C tier anywhere requires two distinct normalized reviewers', () => {
  for (const field of ['depth_confidence', 'undertone_confidence', 'rank_confidence', 'modifier_confidence']) {
    const data = input();
    Object.assign(data.label, { depth_confidence: 'B', undertone_confidence: 'B', rank_confidence: 'B', modifier_confidence: { olive: 'B' } });
    data.label[field] = field === 'modifier_confidence' ? { olive: 'C' } : 'C';
    data.label.reviewer_ids = ['Alice Smith', 'ALICESMITH'];
    assert.throws(() => prepareLabel(data, 'approve'), /two distinct/);
  }
});
test('drafts allow unknown fields of evidence, approval rejects incomplete or inferred evidence', () => {
  const data = input(); data.label.depth_confidence = 'D';
  assert.doesNotThrow(() => prepareLabel(data, 'draft'));
  assert.throws(() => prepareLabel(data, 'approve'), /approval/);
  data.label.depth_confidence = 'B'; delete data.label.source_url;
  assert.throws(() => prepareLabel(data, 'approve'), /source_url/);
});
test('rejects unsupported fields, invalid modifiers, invalid ranges and measured evidence', () => {
  for (const patch of [{ status: 'approved' }, { lab_l: 50 }, { depth_band: 11 },
    { depth_confidence: 'M' }, { modifier_confidence: {} }, { undertone_modifiers: ['blue'] },
    { reviewer_ids: [' '] }, { source_as_of: '2026-02-30' }]) {
    const data = input(); Object.assign(data.label, patch);
    assert.throws(() => prepareLabel(data, 'draft'));
  }
});
test('requires explicit expected binding and exact shade identity', () => {
  const data = input(); delete data.expected_label_id;
  assert.throws(() => prepareLabel(data, 'draft'), /expected_label_id/);
});
test('queue uses stable bounded pagination and never writes', async () => {
  const calls = [];
  const result = await run(['queue', '20', '10'], async (path, options) => {
    calls.push([path, options]); return [];
  });
  assert.deepEqual(result, []);
  assert.match(calls[0][0], /catalog_needs_label.*order=variant_gid.*limit=20.*offset=10/);
  assert.equal(calls[0][1], undefined);
});
test('show exports editable evidence and expected binding', async () => {
  const result = await run(['show', input().variant_gid], async path => {
    if (path.startsWith('catalog_needs_label')) return [input()];
    if (path.startsWith('catalog_label_bindings')) return [{ label_id: 'old' }];
    return [{ id: 'old', status: 'unverified', native_depth: 'Tan', reviewer_ids: [] }];
  });
  assert.equal(result.expected_label_id, 'old');
  assert.equal(result.label.native_depth, 'Tan');
  assert.equal(result.label.id, undefined);
});
test('submit validates before calling atomic RPC; no direct table writes', async () => {
  const calls = [];
  await run(['approve', 'review.json'], async (...args) => { calls.push(args); return 'new-id'; }, async () => JSON.stringify(input()));
  assert.equal(calls[0][0], 'rpc/catalog_submit_label');
  assert.equal(calls[0][1].body.p_action, 'approve');
  assert.equal(calls[0][1].body.p_review.label.reviewer_ids[0], 'alicesmith');
  await assert.rejects(run(['approve', 'bad.json'], async () => assert.fail(), async () => '{}'));
});
test('rejects unknown commands, excessive queue size and missing shades', async () => {
  await assert.rejects(run(['delete'], async () => []), /Usage/);
  await assert.rejects(run(['queue', '1001'], async () => []), /limit/);
  await assert.rejects(run(['show', 'missing'], async () => []), /queue/);
});

test('request keeps credential in headers, disallows redirects and redacts failures', async () => {
  const env = { SUPABASE_URL: 'https://example.com', SUPABASE_SERVICE_ROLE_KEY: 'test-only-key' };
  const request = createRequest(env, async (url, options) => {
    assert.equal(url, 'https://example.com/rest/v1/rpc/catalog_submit_label');
    assert.equal(options.headers.Authorization, 'Bearer test-only-key');
    assert.equal(options.redirect, 'error');
    assert.equal(options.body, '{"test":true}');
    return { ok: true, json: async () => 'saved' };
  });
  assert.equal(await request('rpc/catalog_submit_label', { method: 'POST', body: { test: true } }), 'saved');
  await assert.rejects(createRequest(env, async () => { throw new Error('test-only-key'); })('x'), /Catalogue request failed/);
  await assert.rejects(createRequest(env, async () => ({ ok: false, status: 409 }))('x'), /HTTP 409/);
  assert.throws(() => createRequest({}), /server-only/);
  for (const url of ['http://example.com', 'https://user:password@example.com', 'https://example.com/rest/v1']) {
    assert.throws(() => createRequest({ ...env, SUPABASE_URL: url }));
  }
});

function cli(args, env = {}, preload = []) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [...preload, 'scripts/catalog-label.mjs', ...args], {
      env: { ...process.env, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', ...env },
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

test('CLI queue runs through the transport using a fetch fixture', async () => {
  const fixture = `globalThis.fetch = async (url, options) => {
    if (options.headers.apikey !== 'fixture-only' || !url.startsWith('https://example.com/rest/v1/catalog_needs_label')) throw Error('unexpected request');
    return new Response(JSON.stringify([{ variant_gid: 'fixture-variant' }]), { status: 200 });
  };`;
  const result = await cli(['queue'], { SUPABASE_URL: 'https://example.com', SUPABASE_SERVICE_ROLE_KEY: 'fixture-only' },
    ['--import', 'data:text/javascript,' + encodeURIComponent(fixture)]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout)[0].variant_gid, 'fixture-variant');
});

test('CLI help needs no credentials and failures exit nonzero without dumping environment', async () => {
  assert.equal((await cli(['--help'])).code, 0);
  const failed = await cli(['queue']);
  assert.equal(failed.code, 1);
  assert.match(failed.stderr, /Set server-only/);
});
