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

export function buildRequest(config, rawEmail) {
  const base = config.supabaseUrl.replace(/\/+$/, '');
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
        p_email: rawEmail.trim().toLowerCase(),
        // The checkbox is required by the form; the RPC rejects anything else.
        p_attested: true,
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

/** Fails closed: an unmapped outcome reports failure rather than claiming success, so a
 *  future branch that forgets its case can't tell someone they joined when they didn't. */
export function messageFor(outcome) {
  return MESSAGES[outcome] ?? MESSAGES[OUTCOMES.SERVER];
}
