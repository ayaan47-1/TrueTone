import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRequest,
  buildLeaveRequest,
  parseToken,
  classifyResponse,
  messageFor,
  parsePhone,
  SMS_CONSENT_VERSION,
  OUTCOMES,
} from '../../web/waitlist-client.js';

const CONFIG = { supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'anon-key' };

// ── request shape ─────────────────────────────────────────────────────────────
test('posts to the join_waitlist RPC, never to the table', () => {
  // Going through the RPC is what keeps the list unreadable: anon holds no table
  // privileges (migration 0014), so a direct PostgREST table call would 401 anyway.
  const req = buildRequest(CONFIG, { email: 'Reader@Example.com' });
  assert.equal(req.url, 'https://abc.supabase.co/rest/v1/rpc/join_waitlist');
  assert.equal(req.options.method, 'POST');
});

test('sends the anon key in both headers PostgREST requires', () => {
  const { options } = buildRequest(CONFIG, { email: 'a@b.co' });
  assert.equal(options.headers.apikey, 'anon-key');
  assert.equal(options.headers.Authorization, 'Bearer anon-key');
  assert.equal(options.headers['Content-Type'], 'application/json');
});

test('trims and lowercases the email before it leaves the browser', () => {
  // The RPC normalises too; doing it here as well keeps the payload predictable.
  const { options } = buildRequest(CONFIG, { email: '  Reader@Example.COM ' });
  assert.deepEqual(JSON.parse(options.body), {
    p_email: 'reader@example.com',
    p_attested: true,
    p_phone: null,
    p_sms_consent: false,
    p_sms_consent_version: null,
  });
});

test('tolerates a trailing slash on the configured Supabase URL', () => {
  const req = buildRequest({ ...CONFIG, supabaseUrl: 'https://abc.supabase.co/' }, { email: 'a@b.co' });
  assert.equal(req.url, 'https://abc.supabase.co/rest/v1/rpc/join_waitlist');
});

// ── unsubscribe ───────────────────────────────────────────────────────────────
// The page promises "unsubscribe in one click" in writing, so the mechanism has to exist.
test('unsubscribe posts the token to leave_waitlist', () => {
  const req = buildLeaveRequest(CONFIG, '11111111-2222-3333-4444-555555555555');
  assert.equal(req.url, 'https://abc.supabase.co/rest/v1/rpc/leave_waitlist');
  assert.deepEqual(JSON.parse(req.options.body), {
    p_token: '11111111-2222-3333-4444-555555555555',
  });
});

test('parseToken reads a well-formed token from the query string', () => {
  assert.equal(
    parseToken('?token=11111111-2222-3333-4444-555555555555'),
    '11111111-2222-3333-4444-555555555555',
  );
});

test('parseToken rejects anything that is not a UUID', () => {
  // Refusing early means a junk link shows "check your link" instead of firing a
  // pointless request that would answer 204 anyway and look like it worked.
  assert.equal(parseToken('?token=not-a-uuid'), null);
  assert.equal(parseToken('?token='), null);
  assert.equal(parseToken(''), null);
  assert.equal(parseToken('?other=1'), null);
});

// ── response classification ───────────────────────────────────────────────────
test('204 and 200 both count as joined', () => {
  // join_waitlist returns void, so PostgREST answers 204; 200 is accepted defensively.
  assert.equal(classifyResponse(204), OUTCOMES.OK);
  assert.equal(classifyResponse(200), OUTCOMES.OK);
});

test('a rejected email is reported as invalid, not as a server fault', () => {
  assert.equal(classifyResponse(400), OUTCOMES.INVALID);
  assert.equal(classifyResponse(422), OUTCOMES.INVALID);
});

test("an auth failure is a misconfiguration, not the visitor's problem", () => {
  assert.equal(classifyResponse(401), OUTCOMES.CONFIG);
  assert.equal(classifyResponse(403), OUTCOMES.CONFIG);
});

test('rate limiting and server faults are distinguished', () => {
  assert.equal(classifyResponse(429), OUTCOMES.RATE);
  assert.equal(classifyResponse(500), OUTCOMES.SERVER);
  assert.equal(classifyResponse(503), OUTCOMES.SERVER);
});

// ── messages ──────────────────────────────────────────────────────────────────
test('every outcome has a message, so no failure can pass silently', () => {
  for (const outcome of Object.values(OUTCOMES)) {
    const msg = messageFor(outcome);
    assert.ok(msg.text.length > 0, `${outcome} has no text`);
    assert.ok(['ok', 'err'].includes(msg.tone), `${outcome} has no tone`);
  }
});

test('only the success outcome reads as success', () => {
  assert.equal(messageFor(OUTCOMES.OK).tone, 'ok');
  for (const outcome of Object.values(OUTCOMES)) {
    if (outcome !== OUTCOMES.OK) assert.equal(messageFor(outcome).tone, 'err', outcome);
  }
});

test('an unknown outcome fails closed rather than claiming success', () => {
  // A future branch that forgets to map its case must not tell someone they are
  // on the list when nothing was stored.
  assert.equal(messageFor('something-new').tone, 'err');
});

test('the success message does not overpromise', () => {
  // The page states we email once. The confirmation must not imply more than that.
  const text = messageFor(OUTCOMES.OK).text.toLowerCase();
  assert.ok(text.includes('list'));
  assert.equal(/newsletter|updates|regularly|weekly/.test(text), false);
});

// ── phone parsing ─────────────────────────────────────────────────────────────
test('parsePhone accepts the ways people actually type a number', () => {
  for (const raw of ['2125550100', '(212) 555-0100', '212-555-0100', '+1 212 555 0100', '12125550100']) {
    assert.deepEqual(parsePhone(raw), { status: 'ok', e164: '+12125550100' }, raw);
  }
});

test('parsePhone distinguishes blank from malformed', () => {
  // Blank is fine — the field is optional. Malformed needs to be reported, so a
  // single return value that conflates them would be wrong.
  assert.deepEqual(parsePhone(''), { status: 'blank' });
  assert.deepEqual(parsePhone('   '), { status: 'blank' });
  assert.deepEqual(parsePhone(undefined), { status: 'blank' });
  for (const raw of ['212555010', '21255501000', '+442071838750', 'call me', '+19115550100']) {
    assert.equal(parsePhone(raw).status, 'invalid', raw);
  }
});

test('buildRequest omits the phone entirely when the box is unticked', () => {
  // We should not receive a number the visitor did not consent to give us.
  const { options } = buildRequest(CONFIG, {
    email: 'a@b.com', phone: '2125550100', smsConsent: false,
  });
  const body = JSON.parse(options.body);
  assert.equal(body.p_phone, null);
  assert.equal(body.p_sms_consent, false);
  assert.equal(body.p_sms_consent_version, null);
});

test('buildRequest sends the normalized number and the version consented to', () => {
  const { options } = buildRequest(CONFIG, {
    email: 'a@b.com', phone: '(212) 555-0100', smsConsent: true,
  });
  const body = JSON.parse(options.body);
  assert.equal(body.p_phone, '+12125550100');
  assert.equal(body.p_sms_consent, true);
  assert.equal(body.p_sms_consent_version, SMS_CONSENT_VERSION);
});
