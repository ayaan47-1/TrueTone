// scripts/__tests__/check-no-image-egress-sinks.test.mjs
// Layer-2 assurance: the sink / co-occurrence + network-layer scans catch the
// egress classes that the legacy token scan (findEgress) misses, with low false
// positives. See docs/security/tt-gap11-image-egress-threat-model.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findSinkLeaks,
  stripCommentsAndStrings,
  findEgress,
} from '../check-no-image-egress.mjs';

// --- the leaks token-matching misses (MUST be flagged) ---

test('base64 read handed to supabase.rpc is caught (token scan misses it)', () => {
  const src = "const b64 = await readAsStringAsync(uri); await supabase.rpc('record_scan', { p_image: b64 });";
  // legacy layer sees nothing: none of its 5 tokens are present and readAsStringAsync is allow-listed
  assert.deepEqual(findEgress(src), []);
  // layer 2 catches the base64 read reaching an rpc sink
  assert.ok(findSinkLeaks(src, 'pipeline').length >= 1);
});

test('the REAL image variable name (photoUri) reaching fetch is caught', () => {
  const src = 'await fetch(url, { body: photoUri });';
  assert.deepEqual(findEgress(src), []); // legacy only knows `imageUri`, not `photoUri`
  const hits = findSinkLeaks(src, 'pipeline');
  assert.equal(hits.length, 1);
  assert.match(hits[0].sinks.join(), /fetch/);
});

test('logging the image uri is egress (console sink)', () => {
  const hits = findSinkLeaks('console.log(photoUri);', 'pipeline');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].kind, 'image-ref-reaches-sink');
});

test('crash reporter attaching the image is caught', () => {
  assert.ok(findSinkLeaks('captureException(e, { extra: { base64 } });', 'pipeline').length >= 1);
});

test('supabase table insert of an image ref is caught', () => {
  const src = "await supabase.from('leaks').insert({ img: photoUri });";
  assert.ok(findSinkLeaks(src, 'pipeline').length >= 1);
});

test('network layer may not even reference an image symbol', () => {
  const hits = findSinkLeaks('function upload(photoUri) { return post(photoUri); }', 'network');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].kind, 'image-ref-in-network-layer');
});

test('base64 read on one line, sent on the NEXT line, is caught (intra-file taint)', () => {
  const src = [
    'const b64 = await readAsStringAsync(uri);',
    "await supabase.rpc('record_scan', { p_image: b64 });",
  ].join('\n');
  const hits = findSinkLeaks(src, 'pipeline');
  assert.ok(hits.length >= 1, 'split-line base64 leak must be caught');
  assert.match(JSON.stringify(hits), /tainted:b64/);
});

test('taint follows one more hop (b64 -> payload -> sink)', () => {
  const src = [
    'const b64 = await readAsStringAsync(uri);',
    'const payload = { img: b64 };',
    'await fetch(url, { body: payload });',
  ].join('\n');
  assert.ok(findSinkLeaks(src, 'pipeline').length >= 1);
});

// --- legitimate patterns (MUST pass: low false positives) ---

test('derived scores to supabase.rpc pass (the allowed boundary crossing)', () => {
  const src = "await supabase.rpc('record_scan', { p_scores: r.scores, p_skin_type: r.skinType });";
  assert.deepEqual(findSinkLeaks(src, 'pipeline'), []);
  assert.deepEqual(findSinkLeaks(src, 'network'), []);
});

test('local decode / delete of the uri pass (no sink on the line)', () => {
  assert.deepEqual(findSinkLeaks('const { rgb } = await decode(photoUri);', 'pipeline'), []);
  assert.deepEqual(findSinkLeaks('await FileSystem.deleteAsync(uri, { idempotent: true });', 'pipeline'), []);
});

test('a comment or string mentioning upload/photoUri does not false-positive', () => {
  assert.deepEqual(findSinkLeaks('// never fetch(photoUri) to a server\nconst x = 1;', 'pipeline'), []);
  assert.deepEqual(findSinkLeaks('const msg = "do not upload photoUri anywhere";', 'pipeline'), []);
  // and the network-layer rule also ignores the same string/comment
  assert.deepEqual(findSinkLeaks('const help = "photoUri stays on device";', 'network'), []);
});

test('inline egress-ok suppression is honored and stays greppable', () => {
  const src = 'console.log(photoUri); // egress-ok: local dev overlay, never shipped';
  assert.deepEqual(findSinkLeaks(src, 'pipeline'), []);
});

// --- lexer soundness ---

test('stripCommentsAndStrings preserves code but blanks string/comment contents', () => {
  const out = stripCommentsAndStrings('const a = "upload"; /* fetch */ foo(bar); // photoUri');
  assert.ok(!out.includes('upload'));
  assert.ok(!out.includes('fetch'));
  assert.ok(out.includes('foo(bar)'));
});

test('template-literal ${} expressions are kept (a real sink inside them still counts)', () => {
  const src = 'const q = `x ${fetch(photoUri)} y`;';
  assert.ok(findSinkLeaks(src, 'pipeline').length >= 1);
});
