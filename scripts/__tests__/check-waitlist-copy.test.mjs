import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  htmlToCopy,
  findBannedTerms,
  findUnnegatedMedicalTerms,
  findForeignOrigins,
  findMissingDisclosures,
  auditHtml,
} from '../check-waitlist-copy.mjs';

// This gate exists because a cosmetic product's intended use is established by the words
// on its marketing page (CLAUDE.md §0). It cannot simply reuse DISEASE_BLOCKLIST from
// src/content/cosmetic-vocab.ts: that list governs *model output*, which must never emit
// "diagnosis" at all, whereas this page's disclaimers are required to say it. Hence two
// rules — terms banned outright, and terms allowed only when disclaimed.

// ── htmlToCopy: only prose is copy ──────────────────────────────────────────────
// CSS selectors, script bodies and author comments are not user-facing, and scanning
// them produces false positives (e.g. a `.condition` class name).
test('htmlToCopy drops style, script and comment content', () => {
  const copy = htmlToCopy(
    '<style>.acne{color:red}</style><script>var melanoma=1</script>' +
      '<!-- eczema note --><p>Hydration looks balanced.</p>',
  );
  assert.equal(copy.includes('acne'), false);
  assert.equal(copy.includes('melanoma'), false);
  assert.equal(copy.includes('eczema'), false);
  assert.ok(copy.includes('Hydration looks balanced.'));
});

test('htmlToCopy keeps attribute-borne copy that users actually read', () => {
  const copy = htmlToCopy('<meta name="description" content="Clinically proven results" />');
  assert.ok(copy.includes('Clinically proven results'));
});

// ── hard bans: no safe framing exists ─────────────────────────────────────────
test('flags a disease name even inside a reassuring sentence', () => {
  // A disease name on a cosmetic page establishes intended use however it is framed,
  // so unlike the disclaimer words there is no context that rescues it.
  const hits = findBannedTerms('TrueTone will never tell you that you have rosacea.');
  assert.deepEqual(hits.map((h) => h.term), ['rosacea']);
});

test('flags structure-function claims', () => {
  const terms = findBannedTerms('It boosts collagen and repairs your skin barrier.').map((h) => h.term);
  assert.ok(terms.includes('boosts collagen'));
  assert.ok(terms.includes('repairs your skin barrier'));
});

test('flags unbacked accuracy and equity claims', () => {
  const terms = findBannedTerms(
    'Clinically proven, dermatologist-level accuracy, validated across every skin tone.',
  ).map((h) => h.term);
  assert.ok(terms.includes('clinically proven'));
  assert.ok(terms.includes('dermatologist-level'));
  assert.ok(terms.includes('validated across'));
});

test('flags a bare percentage as an unbacked statistic', () => {
  // CLAUDE.md §1 names a "%" stat specifically; none may ship without data on file.
  assert.deepEqual(findBannedTerms('94% accurate on every skin tone.').map((h) => h.term), ['94%']);
});

test('does not flag the approved cosmetic vocabulary', () => {
  assert.deepEqual(
    findBannedTerms('Hydration look, texture, pores, evenness and the appearance of dark spots.'),
    [],
  );
});

test('does not flag "dermatologist" on its own', () => {
  // Referring people to a dermatologist is the required behaviour, not a claim.
  assert.deepEqual(findBannedTerms('For anything concerning, see a dermatologist.'), []);
});

// ── disclaimer words: allowed only when negated or redirected ─────────────────
test('allows medical words inside a negated disclaimer', () => {
  const text =
    'Not a diagnosis. TrueTone does not diagnose, treat, cure or prevent any condition. ' +
    "It can't tell you whether something is a medical condition, and it won't try.";
  assert.deepEqual(findUnnegatedMedicalTerms(text), []);
});

test('allows medical words in a sentence that redirects to a doctor', () => {
  // The required behaviour for a mole or lesion is a referral, and a referral sentence
  // is phrased affirmatively ("ask it and it will tell you to see a dermatologist").
  const text = 'Ask it about a mole or a lesion and it will tell you to see a dermatologist.';
  assert.deepEqual(findUnnegatedMedicalTerms(text), []);
});

test('accepts "consult a dermatologist" as a redirect, not just "see a dermatologist"', () => {
  // Sentence carries a gated term ("mole"), so only the redirect can rescue it.
  const text = 'Ask about a mole and it will tell you to consult a board-certified dermatologist.';
  assert.deepEqual(findUnnegatedMedicalTerms(text), []);
});

test('gates "disease", which only ever appears in a disclaimer', () => {
  assert.deepEqual(
    findUnnegatedMedicalTerms('It does not diagnose, treat, or prevent any disease or condition.'),
    [],
  );
  assert.deepEqual(
    findUnnegatedMedicalTerms('TrueTone spots disease early.').map((h) => h.term),
    ['disease'],
  );
});

test('flags a medical word used affirmatively', () => {
  const hits = findUnnegatedMedicalTerms('TrueTone gives you a diagnosis in seconds.');
  assert.deepEqual(hits.map((h) => h.term), ['diagnosis']);
});

test('flags treatment claims that carry no disclaimer', () => {
  const terms = findUnnegatedMedicalTerms('It treats dryness and heals your skin.').map((h) => h.term);
  assert.ok(terms.includes('treats'));
  assert.ok(terms.includes('heals'));
});

test('negation only rescues the sentence it appears in', () => {
  // Guards against a nearby "not" laundering a claim in the following sentence.
  const hits = findUnnegatedMedicalTerms('This is not medical advice. It detects any condition.');
  assert.deepEqual(hits.map((h) => h.term), ['condition']);
});

// ── third-party origins ───────────────────────────────────────────────────────
test('flags any host outside the allowlist', () => {
  const html =
    '<link href="https://fonts.googleapis.com/css2?family=Fraunces" rel="stylesheet">' +
    '<script src="https://connect.facebook.net/en_US/fbevents.js"></script>';
  const hosts = findForeignOrigins(html, ['db.example.supabase.co']);
  assert.ok(hosts.includes('fonts.googleapis.com'));
  assert.ok(hosts.includes('connect.facebook.net'));
});

test('allows the Supabase origin the form must reach', () => {
  const html = '<script>fetch("https://db.example.supabase.co/rest/v1/rpc/join_waitlist")</script>';
  assert.deepEqual(findForeignOrigins(html, ['db.example.supabase.co']), []);
});

test('relative and anchor links are not foreign origins', () => {
  assert.deepEqual(
    findForeignOrigins('<a href="/policies/privacy.html">P</a><a href="#join">J</a>', []),
    [],
  );
});

// ── required disclosures ──────────────────────────────────────────────────────
test('reports each disclosure the page fails to make', () => {
  const missing = findMissingDisclosures('<p>Join the waitlist.</p>');
  assert.ok(missing.includes('not a medical device'));
  assert.ok(missing.includes('no diagnosis'));
  assert.ok(missing.includes('18+'));
  assert.ok(missing.includes('United States only'));
});

test('a page carrying every disclosure reports none missing', () => {
  const html =
    '<p>TrueTone is not a medical device and does not diagnose anything.</p>' +
    '<p>United States only. You must be 18 or older.</p>';
  assert.deepEqual(findMissingDisclosures(html), []);
});

// ── auditHtml: the composed gate ──────────────────────────────────────────────
test('auditHtml passes a compliant page', () => {
  const html = `
    <p>Your skin, read honestly. Hydration, texture, pores and evenness.</p>
    <p>Not a diagnosis. TrueTone is not a medical device and does not diagnose,
       treat, cure or prevent any condition. See a dermatologist.</p>
    <p>United States only. 18 or older.</p>
    <a href="/policies/privacy.html">Privacy</a>`;
  assert.deepEqual(auditHtml(html, { allowedHosts: [] }), []);
});

test('auditHtml can skip the disclosure rule for pages that are not the landing page', () => {
  // A policy page states the terms; it is not where the product makes its pitch, so it
  // carries no duty to repeat the "not a medical device" line in that form.
  const html = '<p>Consent records are retained as de-identified receipts.</p>';
  const kinds = auditHtml(html, { allowedHosts: [], requireDisclosures: false }).map((v) => v.kind);
  assert.equal(kinds.includes('missing-disclosure'), false);
});

test('auditHtml gathers violations from every rule at once', () => {
  const html = '<p>Clinically proven to clear up eczema.</p><img src="https://evil.example/p.gif">';
  const kinds = new Set(auditHtml(html, { allowedHosts: [] }).map((v) => v.kind));
  assert.ok(kinds.has('banned-term'));
  assert.ok(kinds.has('foreign-origin'));
  assert.ok(kinds.has('missing-disclosure'));
});

// ── SMS disclosures ───────────────────────────────────────────────────────────
// A page that collects phone numbers owes the TCPA disclosure. This is the rule that
// actually bites: a future redesign that drops the fine print while keeping the input
// is exactly the failure worth catching in CI.
const TEL_PAGE = (disclosure) => `
  <main><form>
    <input id="email" type="email" />
    <input id="phone" type="tel" />
    <label>${disclosure}</label>
  </form></main>`;

const FULL = "Text me when TrueTone launches. ~1-2 messages. Msg &amp; data rates may " +
             "apply. Reply STOP to opt out. Consent isn't required to join.";

// auditHtml returns a flat array of { kind, term } violations, so pull out just ours.
const smsGaps = (html) =>
  auditHtml(html, { requireDisclosures: false })
    .filter((v) => v.kind === 'missing-sms-disclosure')
    .map((v) => v.term);

test('a tel input with the full disclosure passes', () => {
  assert.deepEqual(smsGaps(TEL_PAGE(FULL)), []);
});

test('each missing disclosure element is reported', () => {
  const cases = {
    frequency: FULL.replace('~1-2 messages. ', ''),
    rates: FULL.replace('Msg &amp; data rates may apply. ', ''),
    stop: FULL.replace('Reply STOP to opt out. ', ''),
    optional: FULL.replace("Consent isn't required to join.", ''),
  };
  for (const [id, disclosure] of Object.entries(cases)) {
    assert.deepEqual(smsGaps(TEL_PAGE(disclosure)), [id], `expected ${id} to be reported missing`);
  }
});

test('a page with no tel input owes no SMS disclosure', () => {
  // requireDisclosures is false here and the rule still applies: what triggers it is the
  // presence of a phone field, not which page it is.
  assert.deepEqual(smsGaps('<main><form><input id="email" type="email" /></form></main>'), []);
});

test('the rates rule survives htmlToCopy deleting the &amp; entity', () => {
  // htmlToCopy strips character entities, so the ampersand the page actually renders is
  // gone by the time the rule sees the copy. A pattern that insists on a literal "&"
  // would reject the very page it exists to protect — this pins that down.
  assert.equal(htmlToCopy('<p>Msg &amp; data rates may apply.</p>').includes('&'), false);
  assert.deepEqual(smsGaps(TEL_PAGE(FULL)), []);
});
