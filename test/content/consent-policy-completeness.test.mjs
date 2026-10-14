import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { policyKeysFromManifest } from '../../scripts/sync-policy-bodies.mjs';

const manifest = readFileSync('src/content/manifest.ts', 'utf8');
const privacy = readFileSync('src/content/privacy.md', 'utf8');
const retention = readFileSync('src/content/retention.md', 'utf8');
const terms = readFileSync('src/content/terms.md', 'utf8');
const asRenderedCopy = (markdown) => markdown.replace(/\s+/g, ' ');

test('the versioned AI consent receipt resolves to the published Draft A text', () => {
  assert.ok(policyKeysFromManifest(manifest).includes('ai_routine_chat'));
  const aiConsent = asRenderedCopy(readFileSync('src/content/ai_routine_chat.md', 'utf8'));
  assert.match(aiConsent, /Optional AI routine and chat/);
  assert.match(aiConsent, /Anthropic does not receive your face photo or your raw numeric scan scores\./);
  assert.match(aiConsent, /I separately consent to TrueTone LLC/);
});

test('published consent copy contains no unresolved entity or contact placeholders', () => {
  const contentFiles = readdirSync('src/content', { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `src/content/${entry.name}`);
  const consentFiles = readdirSync('src/features/consent', { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `src/features/consent/${entry.name}`);
  const checkedFiles = [...contentFiles, 'src/content/bodies.ts', ...consentFiles];
  const forbidden = ['LEGAL ENTITY NAME', 'CONTACT EMAIL'].map((name) => `[${name}]`);

  for (const path of checkedFiles) {
    const source = readFileSync(path, 'utf8');
    for (const placeholder of forbidden) {
      assert.equal(source.includes(placeholder), false, `${path} contains ${placeholder}`);
    }
  }
});

test('the public retention schedule remains complete for waitlist data', () => {
  const copy = asRenderedCopy(retention);
  assert.match(copy, /Waitlist email/);
  assert.match(copy, /90 days after we send you that invite/);
  assert.match(copy, /Referral code and source tag/);
  assert.match(copy, /3 years after you join if we never do/);
});

test('privacy states every Draft A biometric purpose', () => {
  const copy = asRenderedCopy(privacy);
  assert.match(copy, /show your cosmetic skin-appearance results/);
  assert.match(copy, /match you to cosmetic shades/);
  assert.match(copy, /suggest a brand-neutral cosmetic routine/);
  assert.match(copy, /show your own prior reads over time/);
});

test('terms describes results without inaccurately calling every path AI-generated', () => {
  assert.doesNotMatch(terms, /AI-generated estimates/);
  assert.match(terms, /cosmetic appearance estimates/);
});
