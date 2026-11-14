import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createChatEndpoint } from '../../supabase/functions/_shared/recommend/endpoint.ts';
import { ROUTINE_CHAT_AVAILABLE } from '../../supabase/functions/_shared/recommend/availability.ts';

const request = (body) => new Request('http://localhost/routine-chat', {
  method: 'POST', headers: { Authorization: 'Bearer synthetic-jwt', 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function shellEndpoint(enabled) {
  let endpoint;
  const calls = { database: 0, provider: 0, payloads: [] };
  const source = readFileSync('supabase/functions/routine-chat/index.ts', 'utf8').replace(/^import .*$/gm, '');
  runInNewContext(stripTypeScriptTypes(source), {
    serve: handler => { endpoint = handler; }, createChatEndpoint, ROUTINE_CHAT_AVAILABLE: enabled,
    Deno: { env: { get: () => 'synthetic-secret-canary' } },
    createClient() { calls.database++; return { rpc: async () => ({ data: true, error: null }) }; },
    Anthropic: class {
      constructor() { calls.provider++; }
      messages = { create: async payload => {
        calls.payloads.push(payload);
        return { content: [{ type: 'text', text: 'A cleanser removes makeup.' }] };
      } };
    },
    console: { error() { throw new Error('unexpected log'); } },
  });
  return { endpoint, calls };
}

test('the actual production shell initializes neither client while held', async () => {
  const { endpoint, calls } = shellEndpoint(ROUTINE_CHAT_AVAILABLE);
  assert.equal((await endpoint(request({ message: 'hi' }))).status, 503);
  assert.equal(calls.database, 0);
  assert.equal(calls.provider, 0);
  assert.equal(calls.payloads.length, 0);
});

test('the actual shell sends an allowlisted completion payload, never scan or credential fields', async () => {
  // Hypothetical enabled path, not a production flag change. Only SDK/DB boundaries are faked.
  const { endpoint, calls } = shellEndpoint(true);
  assert.equal((await endpoint(request({ message: 'What does a cleanser do?', history: [],
    scanId: 'scan-secret-canary', scores: { hydration: 0.1234567 }, skinType: 'type-secret-canary',
    routine: { am: ['routine-secret-canary'] }, user_id: 'user-secret-canary',
  }))).status, 200);
  assert.equal(calls.payloads.length, 1);
  const payload = JSON.parse(JSON.stringify(calls.payloads[0]));
  assert.deepEqual(Object.keys(payload).sort(), ['max_tokens', 'messages', 'model', 'system']);
  assert.deepEqual(payload.messages, [{ role: 'user', content: 'What does a cleanser do?' }]);
  assert.doesNotMatch(JSON.stringify(payload), /secret-canary|0\.1234567|cache_control|user_id/);
});

test('disabled release makes no auth, database, quota or provider calls', async () => {
  let calls = 0;
  const endpoint = createChatEndpoint({ enabled: false, createDeps() { calls++; throw new Error('must not initialize'); } });
  assert.equal((await endpoint(request({ message: 'hi' }))).status, 503);
  assert.equal(calls, 0);
});

test('HTTP payload canaries in unknown context fields never reach completion', async () => {
  let sent;
  const endpoint = createChatEndpoint({ enabled: true, createDeps: () => ({
    consumeQuota: async () => true,
    complete: async (system, messages) => { sent = { system, messages }; return 'A cleanser removes makeup.'; },
  }) });
  const response = await endpoint(request({
    scanId: 'scan-secret-canary', scores: { hydration: 0.1234567 }, skinType: 'skin-secret-canary',
    routine: { am: ['routine-secret-canary'] }, message: 'What does a cleanser do?',
    history: [{ role: 'user', content: 'Hello', user_id: 'user-secret-canary', cache_control: { type: 'ephemeral' } }],
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: 'A cleanser removes makeup.', blocked: false, referred: false });
  assert.deepEqual(sent.messages, [{ role: 'user', content: 'Hello' }, { role: 'user', content: 'What does a cleanser do?' }]);
  assert.doesNotMatch(JSON.stringify(sent), /secret-canary|0\.1234567|cache_control|user_id/);
});

test('provider failures return only a fixed error and fixed diagnostic, never exception text', async () => {
  const diagnostics = [];
  const endpoint = createChatEndpoint({ enabled: true, logFailure: kind => diagnostics.push(kind), createDeps: () => ({
    consumeQuota: async () => true,
    complete: async () => { throw new Error('private-message synthetic-key-canary'); },
  }) });
  const response = await endpoint(request({ message: 'hi' }));
  assert.equal(response.status, 502);
  assert.equal(await response.text(), 'chat unavailable');
  assert.deepEqual(diagnostics, ['completion-failed']);
});

test('method, authorization and body failures never create dependencies', async () => {
  const endpoint = createChatEndpoint({ enabled: true, createDeps() { throw new Error('must not initialize'); } });
  assert.equal((await endpoint(new Request('http://localhost/routine-chat'))).status, 405);
  assert.equal((await endpoint(new Request('http://localhost/routine-chat', { method: 'POST' }))).status, 401);
  assert.equal((await endpoint(request({ message: 42 }))).status, 400);
  assert.equal((await endpoint(new Request('http://localhost/routine-chat', {
    method: 'POST', headers: { Authorization: 'Bearer synthetic-jwt' }, body: '{',
  }))).status, 400);
});

test('the HTTP endpoint preserves referral and quota checks before model completion', async () => {
  let calls = 0;
  const endpoint = createChatEndpoint({ enabled: true, createDeps: () => ({
    consumeQuota: async () => false, complete: async () => { calls++; return 'not called'; },
  }) });
  const referred = await endpoint(request({ message: 'is this mole cancer?' }));
  assert.equal(referred.status, 200);
  assert.equal((await referred.json()).referred, true);
  assert.equal((await endpoint(request({ message: 'What is a cleanser?' }))).status, 429);
  assert.equal(calls, 0);
});

test('production activation is hard-disabled pending separate consent and processor approval', () => {
  const shell = readFileSync('supabase/functions/routine-chat/index.ts', 'utf8');
  assert.match(shell, /enabled: ROUTINE_CHAT_AVAILABLE/);
  assert.match(readFileSync('supabase/functions/_shared/recommend/availability.ts', 'utf8'), /export const ROUTINE_CHAT_AVAILABLE = false;/);
  assert.doesNotMatch(shell, /\.from\(['"]scans['"]\)|loadScan|score_hydration|skin_type_feel/);
});
