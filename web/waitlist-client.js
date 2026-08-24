// Pure logic behind the waitlist form. Kept apart from the DOM wiring in app.js so the
// behaviour that matters — where the request goes, and what each response means — is unit
// tested in test/web/waitlist-client.test.mjs rather than eyeballed in a browser.
//
// Everything here runs in the visitor's browser with the public anon key, which is why the
// write path is the join_waitlist RPC and not the table: migration 0014 revokes every table
// privilege from anon, so the list can be added to but never read.
//
// The shade-pivot dropped SMS entirely: the page collects an email only, plus a referral
// code (?ref=) and privacy-safe UTM/referrer source for the growth loop. There is no phone
// field, no SMS consent, and no consent version on any path.

export const OUTCOMES = {
  OK: 'ok',
  INVALID: 'invalid',
  CONFIG: 'config',
  RATE: 'rate',
  SERVER: 'server',
  NETWORK: 'network',
};

// Referral codes are generated server-side (migration 0017: hex from gen_random_bytes).
// The client stays lenient — any short alphanumeric token — so a change to the generator's
// length or alphabet does not silently start dropping real codes. Anything with punctuation,
// spaces or markup is rejected so a crafted ?ref can never reach the RPC or a share link.
const REFERRAL_CODE = /^[a-z0-9]{6,32}$/i;

// UTM keys we record for the seed phase. A fixed allowlist means an arbitrary query param
// can never be smuggled into what we store.
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const MAX_SOURCE_VALUE = 200;

const base = (config) => config.supabaseUrl.replace(/\/+$/, '');

const authHeaders = (config) => ({
  'Content-Type': 'application/json',
  apikey: config.supabaseAnonKey,
  Authorization: `Bearer ${config.supabaseAnonKey}`,
});

/** Normalise a referral code, or null if it is missing/implausible. */
export function normalizeReferral(raw) {
  const code = (raw ?? '').trim();
  return REFERRAL_CODE.test(code) ? code.toLowerCase() : null;
}

/** Read ?ref= from a query string, validated. */
export function parseReferral(search) {
  return normalizeReferral(new URLSearchParams(search).get('ref'));
}

/** Collect the UTM params and referrer worth attributing a signup to. Returns only the
 *  keys actually present, so an empty object means "a bare visit" and can be sent as null. */
export function captureSource(search, referrer = '') {
  const params = new URLSearchParams(search);
  const source = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) source[key] = value.slice(0, MAX_SOURCE_VALUE);
  }
  const ref = (referrer ?? '').trim();
  if (ref) source.referrer = ref.slice(0, MAX_SOURCE_VALUE);
  return source;
}

export function buildRequest(config, { email, referredBy, source } = {}) {
  const hasSource = source && Object.keys(source).length > 0;
  return {
    url: `${base(config)}/rest/v1/rpc/join_waitlist`,
    options: {
      method: 'POST',
      headers: authHeaders(config),
      body: JSON.stringify({
        p_email: (email ?? '').trim().toLowerCase(),
        // The checkbox is required by the form; the RPC rejects anything else.
        p_attested: true,
        p_referred_by: normalizeReferral(referredBy),
        p_source: hasSource ? source : null,
      }),
    },
  };
}

/** The live counter's read. waitlist_count() (migration 0017) returns a single integer —
 *  a total, never a row — so this is the one path anon has to look at the list at all. */
export function buildCountRequest(config) {
  return {
    url: `${base(config)}/rest/v1/rpc/waitlist_count`,
    options: {
      method: 'POST',
      headers: authHeaders(config),
      body: '{}',
    },
  };
}

/** waitlist_count() answers with a bare scalar; PostgREST may still wrap it in a one-row
 *  array. Anything that isn't a finite number is null so the counter shows nothing rather
 *  than a fake figure. */
export function parseCount(data) {
  const n = Array.isArray(data) ? data[0] : data;
  return Number.isFinite(n) ? n : null;
}

export function buildLeaveRequest(config, token) {
  return {
    url: `${base(config)}/rest/v1/rpc/leave_waitlist`,
    options: {
      method: 'POST',
      headers: authHeaders(config),
      body: JSON.stringify({ p_token: token }),
    },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** leave_waitlist is a silent no-op on an unknown token (so it can't be used to probe the
 *  list), which means a malformed link would otherwise report success. Reject it here. */
export function parseToken(search) {
  const token = new URLSearchParams(search).get('token');
  return token && UUID.test(token) ? token : null;
}

/** join_waitlist returns the caller's own row: their referral code, spot in line and total.
 *  PostgREST may hand back the object directly or wrapped in a one-row array. Anything
 *  without a code (a 204, an error shape) is null, so the UI never fakes a share link. */
export function parseJoinResult(data) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object' || typeof row.code !== 'string' || !row.code) return null;
  const num = (v) => (Number.isFinite(v) ? v : null);
  return {
    code: row.code,
    position: num(row.position),
    total: num(row.total),
    referrals: num(row.referrals) ?? 0,
  };
}

/** The visitor's own shareable link — same-origin, so it stays inside the page's CSP. */
export function buildShareLink(origin, code) {
  return `${(origin ?? '').replace(/\/+$/, '')}/?ref=${code}`;
}

/** One-line status of where they landed, kept vague when the RPC could not tell us. */
export function formatPosition(result) {
  if (result && Number.isFinite(result.position)) {
    return `you're #${result.position} in line. invite friends to move up.`;
  }
  return "you're in line. invite friends to move up.";
}

export function classifyResponse(status) {
  if (status === 200 || status === 201 || status === 204) return OUTCOMES.OK;
  if (status === 400 || status === 422) return OUTCOMES.INVALID;
  if (status === 401 || status === 403) return OUTCOMES.CONFIG;
  if (status === 429) return OUTCOMES.RATE;
  return OUTCOMES.SERVER;
}

const MESSAGES = {
  // A repeat signup lands here too — join_waitlist is idempotent and returns the same row,
  // so re-entering an email just retrieves the visitor's existing spot and link.
  [OUTCOMES.OK]: { tone: 'ok', text: "you're on the list. we'll email you once, when there's a build to try." },
  [OUTCOMES.INVALID]: { tone: 'err', text: 'that email address was rejected. check it and try again.' },
  [OUTCOMES.CONFIG]: { tone: 'err', text: "signup isn't configured correctly right now. please try again later." },
  [OUTCOMES.RATE]: { tone: 'err', text: 'too many attempts just now. give it a minute and try again.' },
  [OUTCOMES.SERVER]: { tone: 'err', text: 'something broke on our end and you were not added. please try again.' },
  [OUTCOMES.NETWORK]: { tone: 'err', text: "couldn't reach us. check your connection and try again." },
};

/** Fails closed: an unmapped outcome reports failure rather than claiming success, so a
 *  future branch that forgets its case can't tell someone they joined when they didn't. */
export function messageFor(outcome) {
  return MESSAGES[outcome] ?? MESSAGES[OUTCOMES.SERVER];
}
