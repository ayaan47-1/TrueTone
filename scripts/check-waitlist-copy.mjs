import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

// Compliance gate for the marketing pages in web/.
//
// US regulators classify software by its intended use, and intended use is established by
// the words in the UI (CLAUDE.md §0). A landing page is therefore a compliance surface,
// not decoration — this script fails the build if the copy drifts across the line.
//
// It deliberately does NOT reuse DISEASE_BLOCKLIST from src/content/cosmetic-vocab.ts.
// That list governs model output, which must never emit "diagnosis" in any form. This page
// is required to say it ("Not a diagnosis", "does not diagnose"). So the rules split in two:
//   • BANNED_TERMS      — no framing makes these acceptable on a cosmetic page
//   • DISCLAIMED_TERMS  — acceptable only in a sentence that negates or redirects
//
// Rule 3 (foreign origins) is what keeps the "no analytics, no pixel, no tag manager"
// promise honest, and is the web-side sibling of scripts/check-no-analytics-sdk.mjs.
// Rule 4 makes deleting a disclaimer a build failure rather than a silent regression.

export const BANNED_TERMS = [
  // Disease and diagnostic nouns. Naming one implies intended use however it is framed.
  'acne', 'rosacea', 'eczema', 'melasma', 'dermatitis', 'psoriasis', 'vitiligo',
  'melanoma', 'carcinoma', 'skin cancer', 'tumor', 'tumour', 'infection',
  // Structure/function claims — the cosmetic/drug line (CLAUDE.md §1).
  'boosts collagen', 'boost collagen', 'stimulates collagen',
  'repairs your skin barrier', 'repairs the skin barrier', 'repairs your barrier',
  'rebuilds collagen', 'reverses aging', 'reverses ageing',
  // Accuracy / efficacy / equity claims. Every one of these needs validation data on
  // file before it may ship; until then the honest move is to not say it.
  'clinically proven', 'clinically-proven', 'clinically tested', 'medically proven',
  'dermatologist-level', 'dermatologist level', 'dermatologist-grade',
  'doctor-approved', 'medical-grade', 'medical grade',
  'fda approved', 'fda-approved', 'fda cleared', 'fda-cleared',
  'validated across', 'proven across', 'works on every skin tone',
  'accurate for every skin tone', 'equally accurate',
];

// Allowed only inside a sentence that disclaims or redirects (see SAFE_CONTEXT).
export const DISCLAIMED_TERMS = [
  'diagnosis', 'diagnose', 'diagnoses', 'diagnostic',
  'condition', 'disease', 'lesion', 'mole', 'medical device',
  'treats', 'treat', 'cures', 'cure', 'heals', 'heal', 'prevents', 'prevent',
];

// A sentence is safe if it denies the claim, or redirects the user to a clinician.
const NEGATIONS = /\b(not|never|no|cannot|can't|won't|don't|doesn't|isn't|aren't|nor|neither|rather than|instead of)\b/i;
const REDIRECTS = /\b((see|consult|talk to|speak to|visit) an? [\w-]*\s?(dermatologist|doctor|clinician)|doctor's job|refer you|professional medical advice)\b/i;
const SAFE_CONTEXT = [NEGATIONS, REDIRECTS];

// Any number followed by % is an efficacy statistic until proven otherwise.
const PERCENT = /\b\d+(?:\.\d+)?%/g;

const REQUIRED_DISCLOSURES = [
  { id: 'not a medical device', pattern: /not a medical device/i },
  { id: 'no diagnosis', pattern: /does not diagnose|not a diagnosis|never diagnoses/i },
  { id: '18+', pattern: /18\+|18 or older/i },
  { id: 'United States only', pattern: /united states|u\.s\. only/i },
];

// Required on any page that collects a phone number. TCPA needs a clear and conspicuous
// disclosure at the point of consent; CTIA guidelines add the opt-out keyword.
//
// Two patterns are looser than they look, on purpose:
//   • frequency matches the phrase directly rather than requiring "message" and a count in
//     a fixed order — the copy reads "~1-2 messages", so an order-dependent pattern would
//     reject the very page it exists to protect.
//   • rates treats the ampersand as optional because htmlToCopy deletes character
//     entities: the page renders "Msg &amp; data rates", which reaches this rule as
//     "Msg data rates". Insisting on a literal "&" would fail every real page.
// Neither loosening weakens the wording itself — test/content/sms-consent.test.mjs pins
// the rendered string to SMS_CONSENT_BODY byte-for-byte. This rule catches deletion.
const SMS_DISCLOSURES = [
  { id: 'frequency', pattern: /~?\s*1\s*-\s*2\s+(msg|message)s?\b/i },
  { id: 'rates',     pattern: /msg\s*&?(amp;)?\s*data rates may apply/i },
  { id: 'stop',      pattern: /\breply STOP\b/i },
  { id: 'optional',  pattern: /consent isn't required/i },
];

/** Strip everything that isn't user-facing prose. Attribute text is kept: a meta
 *  description or alt text is copy a person reads, a CSS selector is not. */
export function htmlToCopy(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    // Keep the value of human-readable attributes, drop the rest of the tag.
    .replace(/<[^>]*\b(?:content|alt|title|placeholder|aria-label)\s*=\s*"([^"]*)"[^>]*>/gi, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text) {
  return text.split(/(?<=[.!?])\s+|\n+|(?:\s+[•·]\s+)/).filter((s) => s.trim());
}

/** Terms that are never acceptable, wherever they appear. */
export function findBannedTerms(text) {
  const copy = htmlToCopy(text);
  const lower = copy.toLowerCase();
  const hits = [];
  for (const term of BANNED_TERMS) {
    // Word-boundary match so "treatment" doesn't trip "treat" style substrings.
    const re = new RegExp(`(?<![a-z])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`, 'i');
    if (re.test(lower)) hits.push({ term, kind: 'banned-term' });
  }
  for (const stat of copy.match(PERCENT) ?? []) hits.push({ term: stat, kind: 'banned-term' });
  return hits;
}

/** Disclaimer vocabulary used without a disclaimer. */
export function findUnnegatedMedicalTerms(text) {
  const hits = [];
  for (const sentence of splitSentences(htmlToCopy(text))) {
    if (SAFE_CONTEXT.some((re) => re.test(sentence))) continue;
    for (const term of DISCLAIMED_TERMS) {
      const re = new RegExp(`(?<![a-z])${term}(?![a-z])`, 'i');
      if (re.test(sentence)) hits.push({ term, kind: 'undisclaimed-term', sentence: sentence.trim() });
    }
  }
  return hits;
}

/** Every host the page can reach that isn't explicitly allowed. Scans raw HTML, since a
 *  tracker hides in an attribute, not in prose. */
export function findForeignOrigins(html, allowedHosts = []) {
  const allowed = new Set(allowedHosts.map((h) => h.toLowerCase()));
  const hosts = new Set();
  for (const [, host] of html.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    const h = host.toLowerCase();
    if (!allowed.has(h)) hosts.add(h);
  }
  return [...hosts];
}

/** Disclosures the page must make. Their absence is a regression, not a style choice. */
export function findMissingDisclosures(html) {
  const copy = htmlToCopy(html);
  return REQUIRED_DISCLOSURES.filter((d) => !d.pattern.test(copy)).map((d) => d.id);
}

/** SMS disclosures owed by any page carrying a phone field. */
export function findMissingSmsDisclosures(html) {
  // No phone field, nothing owed.
  if (!/<input[^>]+type=["']tel["']/i.test(html)) return [];
  const copy = htmlToCopy(html);
  return SMS_DISCLOSURES.filter((d) => !d.pattern.test(copy)).map((d) => d.id);
}

export function auditHtml(html, { allowedHosts = [], requireDisclosures = true } = {}) {
  return [
    ...findBannedTerms(html),
    ...findUnnegatedMedicalTerms(html),
    ...findForeignOrigins(html, allowedHosts).map((host) => ({ kind: 'foreign-origin', term: host })),
    // Only the landing page makes the product's pitch, so only it owes the disclosures.
    // A policy page states the terms in its own words.
    ...(requireDisclosures
      ? findMissingDisclosures(html).map((id) => ({ kind: 'missing-disclosure', term: id }))
      : []),
    // Gated on the phone field, not on the page: any page collecting a number owes this.
    ...findMissingSmsDisclosures(html).map((id) => ({ kind: 'missing-sms-disclosure', term: id })),
  ];
}

function htmlFilesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return htmlFilesUnder(p);
    return extname(e.name) === '.html' ? [p] : [];
  });
}

function scan() {
  // The form has to reach Supabase; that origin is the single permitted exception.
  const supabaseHost = process.env.EXPO_PUBLIC_SUPABASE_URL
    ? new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).hostname
    : null;
  const allowedHosts = [supabaseHost, '127.0.0.1', 'localhost'].filter(Boolean);

  const files = htmlFilesUnder('web');
  if (!files.length) {
    console.log('compliance: no web/ pages to check');
    return;
  }

  let failed = 0;
  for (const file of files) {
    const violations = auditHtml(readFileSync(file, 'utf8'), {
      allowedHosts,
      // The landing page is where the product makes its pitch, so it is the page that
      // owes the disclosures. Policy and unsubscribe pages carry their own text.
      requireDisclosures: file.endsWith(join('web', 'index.html')),
    });
    for (const v of violations) {
      failed += 1;
      console.error(`${file}: [${v.kind}] ${v.term}${v.sentence ? ` — "${v.sentence}"` : ''}`);
    }
  }
  if (failed) {
    console.error(`\ncompliance: ${failed} violation(s) in web/ copy (CLAUDE.md §1)`);
    process.exit(1);
  }
  console.log(`compliance: ${files.length} web page(s) clean`);
}

if (import.meta.url === `file://${process.argv[1]}`) scan();
