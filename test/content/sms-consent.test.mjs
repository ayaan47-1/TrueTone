// The disclosure lives in three places: this module, the 0016 migration seed, and the
// rendered page. They must agree byte-for-byte, or the consent receipt records agreement
// to wording nobody actually saw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SMS_CONSENT_BODY, SMS_CONSENT_VERSION } from '../../src/content/sms-consent.js';

test('the disclosure carries every element TCPA requires', () => {
  assert.match(SMS_CONSENT_BODY, /~1-2 messages/);
  assert.match(SMS_CONSENT_BODY, /Msg & data rates may apply/);
  assert.match(SMS_CONSENT_BODY, /Reply STOP to opt out/);
  assert.match(SMS_CONSENT_BODY, /Consent isn't required/);
});

test('the disclosure is ASCII, so it cannot silently become a UCS-2 SMS', () => {
  // A curly apostrophe or en-dash pasted in by an editor cuts an SMS segment from 160
  // characters to 70 and breaks the byte-for-byte checks below.
  // eslint-disable-next-line no-control-regex
  assert.ok(/^[\x20-\x7E]+$/.test(SMS_CONSENT_BODY), 'disclosure must be printable ASCII');
});

test('the migration seeds exactly this wording', () => {
  const sql = readFileSync(
    new URL('../../supabase/migrations/0016_waitlist_sms.sql', import.meta.url),
    'utf8',
  );
  // SQL escapes a single quote by doubling it.
  assert.ok(
    sql.includes(SMS_CONSENT_BODY.replace(/'/g, "''")),
    'the 0016 seed does not match src/content/sms-consent.js',
  );
  assert.ok(sql.includes(`'${SMS_CONSENT_VERSION}'`), 'the 0016 seed uses a different version');
});

test('the page renders exactly this wording', () => {
  // The third home of the string. Read cwd-independently, like the assertions above.
  const html = readFileSync(new URL('../../web/index.html', import.meta.url), 'utf8');
  assert.ok(
    html.replace(/\s+/g, ' ').includes(SMS_CONSENT_BODY.replace(/&/g, '&amp;')),
    'web/index.html does not render the canonical disclosure',
  );
});

test('web/waitlist-client.js re-declares the same consent version', () => {
  // web/ is served verbatim as static files, so waitlist-client.js cannot import this
  // module — it re-declares SMS_CONSENT_VERSION as a literal instead. Read it as source
  // text (not import it — it may reference browser-only globals) and extract that literal
  // with a regex, the same approach the migration-seed assertion above uses for SQL.
  const source = readFileSync(
    new URL('../../web/waitlist-client.js', import.meta.url),
    'utf8',
  );
  const match = source.match(/export const SMS_CONSENT_VERSION = '([^']+)';/);
  assert.ok(match, 'web/waitlist-client.js does not export SMS_CONSENT_VERSION as expected');
  assert.equal(
    match[1],
    SMS_CONSENT_VERSION,
    'web/waitlist-client.js re-declares a different consent version than src/content/sms-consent.js',
  );
});
