// Pure logic behind the waitlist form. Kept apart from the DOM wiring in app.js so the
// behaviour that matters — where the request goes, and what each response means — is unit
// tested in web/__tests__/waitlist-client.test.mjs rather than eyeballed in a browser.
//
// Everything here runs in the visitor's browser with the public anon key, which is why the
// write path is the join_waitlist RPC and not the table: migration 0014 revokes every table
// privilege from anon, so the list can be added to but never read.

export const OUTCOMES = {
  OK: 'ok',
  INVALID: 'invalid',
  CONFIG: 'config',
  RATE: 'rate',
  SERVER: 'server',
  NETWORK: 'network',
};

// Mirrors src/content/sms-consent.js. Re-declared rather than imported: web/ is served
// verbatim as static files, so an import from src/ would 404 in the browser.
// test/content/sms-consent.test.mjs's 'web/waitlist-client.js re-declares the same
// consent version' case reads this file as source text and asserts the two literals match.
export const SMS_CONSENT_VERSION = 'sms-2026-08-07';

const N11 = /^[2-9]11$/;

/** Three states rather than `string | null`: blank means the optional field was left
 *  alone, invalid means it was filled in wrongly and the visitor needs telling. A
 *  nullable return would conflate the two and silently drop a typo'd number. */
export function parsePhone(raw) {
  const text = (raw ?? '').trim();
  if (text === '') return { status: 'blank' };

  let digits = text.replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) return { status: 'invalid' };

  // Mirrors the CHECK constraint in migration 0016: N11 codes are assignable as neither
  // area code nor exchange, so +19115550100 is not a real number.
  const area = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);
  if (area[0] < '2' || exchange[0] < '2') return { status: 'invalid' };
  if (N11.test(area) || N11.test(exchange)) return { status: 'invalid' };

  return { status: 'ok', e164: `+1${digits}` };
}

export function buildRequest(config, { email, phone, smsConsent } = {}) {
  const base = config.supabaseUrl.replace(/\/+$/, '');
  // Only a consented, well-formed number is transmitted. Anything else is left in the
  // browser: there is no reason for us to receive a number we may not text.
  const parsed = smsConsent ? parsePhone(phone) : { status: 'blank' };
  const e164 = parsed.status === 'ok' ? parsed.e164 : null;

  return {
    url: `${base}/rest/v1/rpc/join_waitlist`,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      },
      body: JSON.stringify({
        p_email: (email ?? '').trim().toLowerCase(),
        // The checkbox is required by the form; the RPC rejects anything else.
        p_attested: true,
        p_phone: e164,
        p_sms_consent: Boolean(e164),
        p_sms_consent_version: e164 ? SMS_CONSENT_VERSION : null,
      }),
    },
  };
}

export function buildLeaveRequest(config, token) {
  const base = config.supabaseUrl.replace(/\/+$/, '');
  return {
    url: `${base}/rest/v1/rpc/leave_waitlist`,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      },
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

export function classifyResponse(status) {
  if (status === 200 || status === 201 || status === 204) return OUTCOMES.OK;
  if (status === 400 || status === 422) return OUTCOMES.INVALID;
  if (status === 401 || status === 403) return OUTCOMES.CONFIG;
  if (status === 429) return OUTCOMES.RATE;
  return OUTCOMES.SERVER;
}

const MESSAGES = {
  // A repeat signup lands here too — join_waitlist is idempotent and deliberately gives
  // no sign of whether the address was already stored.
  [OUTCOMES.OK]: { tone: 'ok', text: "You're on the list. We'll email you once, when there's a build to try." },
  [OUTCOMES.INVALID]: { tone: 'err', text: 'That email address was rejected. Check it and try again.' },
  [OUTCOMES.CONFIG]: { tone: 'err', text: "Signup isn't configured correctly right now. Please try again later." },
  [OUTCOMES.RATE]: { tone: 'err', text: 'Too many attempts just now. Give it a minute and try again.' },
  [OUTCOMES.SERVER]: { tone: 'err', text: 'Something broke on our end and you were not added. Please try again.' },
  [OUTCOMES.NETWORK]: { tone: 'err', text: "Couldn't reach us. Check your connection and try again." },
};

const SMS_OK = {
  tone: 'ok',
  text: "You're on the list. We'll email and text you once, when there's a build to try.",
};

/** Fails closed: an unmapped outcome reports failure rather than claiming success, so a
 *  future branch that forgets its case can't tell someone they joined when they didn't. */
export function messageFor(outcome, { sms = false } = {}) {
  if (outcome === OUTCOMES.OK && sms) return SMS_OK;
  return MESSAGES[outcome] ?? MESSAGES[OUTCOMES.SERVER];
}
