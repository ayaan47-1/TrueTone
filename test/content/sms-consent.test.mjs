// SMS was retired in the shade pivot: the page now collects email + referral only, and
// web/waitlist-client.js no longer carries a consent version. But the wording is kept in
// two places as an archived legal record — this module and the 0016 migration seed — so a
// dump alone still reconstructs exactly what any earlier signup agreed to. They must agree
// byte-for-byte. The last two tests below assert the teardown: the page and the client no
// longer surface SMS at all.
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

test('the pivot removed SMS from the page entirely', () => {
  // The page used to be the third home of this string. After the pivot it collects email
  // + referral only: no phone field, and the disclosure wording must be gone with it.
  const html = readFileSync(new URL('../../web/index.html', import.meta.url), 'utf8');
  assert.equal(/<input[^>]+type=["']tel["']/i.test(html), false, 'a phone field is still on the page');
  assert.equal(
    html.replace(/\s+/g, ' ').includes(SMS_CONSENT_BODY.replace(/&/g, '&amp;')),
    false,
    'the retired SMS disclosure is still rendered on the page',
  );
});

test('web/waitlist-client.js no longer carries a consent version', () => {
  // The client shed every SMS symbol in the pivot (see test/web/waitlist-client.test.mjs,
  // which asserts SMS_CONSENT_VERSION and parsePhone are no longer exported). Guard the
  // source directly so a copy-paste can't quietly reintroduce the literal.
  const source = readFileSync(
    new URL('../../web/waitlist-client.js', import.meta.url),
    'utf8',
  );
  assert.equal(
    /SMS_CONSENT_VERSION/.test(source),
    false,
    'web/waitlist-client.js still references SMS_CONSENT_VERSION after the pivot',
  );
});
