import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRequest,
  buildLeaveRequest,
  parseToken,
  parseReferral,
  captureSource,
  parseJoinResult,
  buildShareLink,
  formatPosition,
  classifyResponse,
  messageFor,
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
    p_referred_by: null,
    p_source: null,
  });
});

test('the SMS/phone surface is gone from the payload entirely', () => {
  // The pivot dropped SMS: no phone, no sms consent, no consent version may be sent.
  const { options } = buildRequest(CONFIG, { email: 'a@b.co' });
  const body = JSON.parse(options.body);
  assert.equal('p_phone' in body, false);
  assert.equal('p_sms_consent' in body, false);
  assert.equal('p_sms_consent_version' in body, false);
});

test('tolerates a trailing slash on the configured Supabase URL', () => {
  const req = buildRequest({ ...CONFIG, supabaseUrl: 'https://abc.supabase.co/' }, { email: 'a@b.co' });
  assert.equal(req.url, 'https://abc.supabase.co/rest/v1/rpc/join_waitlist');
});

test('forwards a valid referral code, normalised to lowercase', () => {
  const { options } = buildRequest(CONFIG, { email: 'a@b.co', referredBy: 'AB12CD34EF' });
  assert.equal(JSON.parse(options.body).p_referred_by, 'ab12cd34ef');
});

test('drops a malformed referral code rather than forwarding junk', () => {
  const { options } = buildRequest(CONFIG, { email: 'a@b.co', referredBy: 'not a code!!' });
  assert.equal(JSON.parse(options.body).p_referred_by, null);
});

test('forwards a captured source object as p_source', () => {
  const source = { utm_source: 'tiktok', utm_campaign: 'seed', referrer: 'https://t.co/x' };
  const { options } = buildRequest(CONFIG, { email: 'a@b.co', source });
  assert.deepEqual(JSON.parse(options.body).p_source, source);
});

test('sends p_source null when nothing was captured', () => {
  const { options } = buildRequest(CONFIG, { email: 'a@b.co', source: {} });
  assert.equal(JSON.parse(options.body).p_source, null);
});

// ── referral parsing ────────────────────────────────────────────────────────
test('parseReferral reads a well-formed code from ?ref', () => {
  assert.equal(parseReferral('?ref=ab12cd34ef'), 'ab12cd34ef');
  assert.equal(parseReferral('?ref=AB12CD34EF&utm_source=ig'), 'ab12cd34ef');
});

test('parseReferral rejects anything that is not a plausible code', () => {
  assert.equal(parseReferral('?ref='), null);
  assert.equal(parseReferral('?ref=has spaces'), null);
  assert.equal(parseReferral('?ref=<script>'), null);
  assert.equal(parseReferral(''), null);
  assert.equal(parseReferral('?other=1'), null);
});

// ── source / UTM capture ──────────────────────────────────────────────────────
test('captureSource collects only the UTM keys that are present', () => {
  const src = captureSource('?utm_source=tiktok&utm_medium=video&utm_campaign=seed', '');
  assert.deepEqual(src, { utm_source: 'tiktok', utm_medium: 'video', utm_campaign: 'seed' });
});

test('captureSource includes a referrer when one is given', () => {
  const src = captureSource('?utm_source=ig', 'https://instagram.com/');
  assert.equal(src.utm_source, 'ig');
  assert.equal(src.referrer, 'https://instagram.com/');
});

test('captureSource returns an empty object for a bare visit', () => {
  assert.deepEqual(captureSource('', ''), {});
});

test('captureSource ignores non-UTM query params and caps value length', () => {
  const src = captureSource('?utm_source=' + 'x'.repeat(500) + '&foo=bar', '');
  assert.equal('foo' in src, false);
  assert.ok(src.utm_source.length <= 200);
});

// ── join result parsing ───────────────────────────────────────────────────────
test('parseJoinResult reads the referral code, position and totals', () => {
  const r = parseJoinResult({ code: 'ab12cd34ef', position: 142, total: 3142, referrals: 3 });
  assert.deepEqual(r, { code: 'ab12cd34ef', position: 142, total: 3142, referrals: 3 });
});

test('parseJoinResult tolerates a single-row PostgREST array wrapper', () => {
  const r = parseJoinResult([{ code: 'ab12cd34ef', position: 1, total: 1, referrals: 0 }]);
  assert.equal(r.code, 'ab12cd34ef');
});

test('parseJoinResult returns null when the payload has no code', () => {
  // A 204 with no body, or a shape we do not recognise, must not fake a share link.
  assert.equal(parseJoinResult(null), null);
  assert.equal(parseJoinResult({}), null);
  assert.equal(parseJoinResult({ position: 3 }), null);
});

// ── share link ────────────────────────────────────────────────────────────────
test('buildShareLink points back at the page with the ref code', () => {
  assert.equal(buildShareLink('https://truetone.app', 'ab12cd34ef'), 'https://truetone.app/?ref=ab12cd34ef');
  assert.equal(buildShareLink('https://truetone.app/', 'ab12cd34ef'), 'https://truetone.app/?ref=ab12cd34ef');
});

// ── position copy ─────────────────────────────────────────────────────────────
test('formatPosition states the spot in line when known', () => {
  assert.match(formatPosition({ code: 'x', position: 142, total: 3142, referrals: 0 }), /142/);
});

test('formatPosition falls back gracefully when position is unknown', () => {
  const text = formatPosition({ code: 'x', position: null, total: null, referrals: 0 });
  assert.ok(text.length > 0);
  assert.equal(/#\d/.test(text), false);
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
  assert.equal(parseToken('?token=not-a-uuid'), null);
  assert.equal(parseToken('?token='), null);
  assert.equal(parseToken(''), null);
  assert.equal(parseToken('?other=1'), null);
});

// ── response classification ───────────────────────────────────────────────────
test('200, 201 and 204 all count as joined', () => {
  // join_waitlist now returns jsonb, so PostgREST answers 200; 204/201 accepted defensively.
  assert.equal(classifyResponse(200), OUTCOMES.OK);
  assert.equal(classifyResponse(201), OUTCOMES.OK);
  assert.equal(classifyResponse(204), OUTCOMES.OK);
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

test('no SMS export leaks in from the retired path', async () => {
  // The pivot removed SMS; importing the old symbol must now be undefined, not a
  // stale constant that some code path could still send.
  const mod = await import('../../web/waitlist-client.js');
  assert.equal('SMS_CONSENT_VERSION' in mod, false);
  assert.equal('parsePhone' in mod, false);
});
