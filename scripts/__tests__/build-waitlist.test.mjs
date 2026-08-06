import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  renderMarkdown,
  renderPolicyPage,
  renderHeaders,
  renderConfig,
} from '../build-waitlist.mjs';

// The policy pages are generated from src/content/*.md so the website and the app can
// never state different terms. A tiny renderer is deliberate: these five documents use
// headings, blockquotes, bold, bullets and paragraphs, and nothing else. Pulling in a full
// CommonMark dependency to publish legal text would add supply-chain surface for no gain.

test('escapes markup so policy text can never inject HTML', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapeHtml('a & b "c"'), 'a &amp; b &quot;c&quot;');
});

test('renders headings at their markdown level', () => {
  assert.ok(renderMarkdown('# Privacy Policy').includes('<h1>Privacy Policy</h1>'));
  assert.ok(renderMarkdown('## Retention').includes('<h2>Retention</h2>'));
});

test('renders a blockquote, which is how the placeholder banner is marked', () => {
  const html = renderMarkdown('> PLACEHOLDER — pending counsel review.');
  assert.ok(html.includes('<blockquote>'));
  assert.ok(html.includes('PLACEHOLDER — pending counsel review.'));
});

test('keeps the placeholder banner visible rather than stripping it', () => {
  // Publishing a draft policy silently would be worse than publishing it labelled.
  const html = renderMarkdown('> PLACEHOLDER — pending counsel review.\n\n# Terms\n\nBody.');
  assert.ok(html.indexOf('PLACEHOLDER') < html.indexOf('<h1>'));
});

test('renders bold and italic spans', () => {
  assert.ok(renderMarkdown('**Purpose:** to describe appearance.').includes('<strong>Purpose:</strong>'));
  assert.ok(renderMarkdown('_(add an address)_').includes('<em>(add an address)</em>'));
});

test('renders a bullet list, keeping wrapped continuation lines in their own item', () => {
  // retention.md hard-wraps its bullets; an indented continuation is not a new bullet.
  const html = renderMarkdown('- **Waitlist:** deleted 90 days after invite,\n  or 3 years after signup.\n- **Account data:** deleted on request.');
  assert.equal((html.match(/<li>/g) ?? []).length, 2);
  assert.ok(html.includes('90 days after invite, or 3 years after signup.'));
});

test('joins wrapped lines into one paragraph', () => {
  const html = renderMarkdown('We never sell, lease, or trade\nbiometric or health data.');
  assert.equal((html.match(/<p>/g) ?? []).length, 1);
  assert.ok(html.includes('We never sell, lease, or trade biometric or health data.'));
});

test('separates paragraphs split by a blank line', () => {
  assert.equal((renderMarkdown('One.\n\nTwo.').match(/<p>/g) ?? []).length, 2);
});

test('escaping happens before inline formatting, not after', () => {
  // Otherwise a policy containing "<b>" could emit live markup.
  const html = renderMarkdown('**<b>** literal');
  assert.ok(html.includes('&lt;b&gt;'));
  assert.equal(html.includes('<b>'), false);
});

test('renderPolicyPage produces a standalone page carrying the policy version', () => {
  const page = renderPolicyPage({
    title: 'Privacy Policy',
    bodyHtml: '<p>Body.</p>',
    version: '2026-06-15.1',
  });
  assert.ok(page.startsWith('<!doctype html>'));
  assert.ok(page.includes('<title>Privacy Policy — TrueTone</title>'));
  assert.ok(page.includes('2026-06-15.1'));
  assert.ok(page.includes('<p>Body.</p>'));
});

test('policy pages self-host their fonts and reach no third-party origin', () => {
  const page = renderPolicyPage({ title: 'Terms of Use', bodyHtml: '<p>x</p>', version: '1' });
  assert.equal(/https?:\/\//.test(page), false);
});

// ── CSP ───────────────────────────────────────────────────────────────────────
// The copy gate catches a tracker committed into the HTML. This catches one injected at
// runtime — belt and braces, because the page's whole claim is that nothing third-party
// touches it (CLAUDE.md §1).

test('CSP denies everything by default and opens only what the page uses', () => {
  const headers = renderHeaders('https://abc.supabase.co');
  assert.ok(headers.includes("default-src 'none'"));
  assert.ok(headers.includes("script-src 'self'"));
  assert.ok(headers.includes("style-src 'self'"));
  assert.ok(headers.includes("font-src 'self'"));
});

test('CSP allows the browser to reach Supabase and nowhere else', () => {
  const headers = renderHeaders('https://abc.supabase.co');
  const connect = headers.match(/connect-src ([^;]+)/)[1];
  assert.equal(connect.trim(), "'self' https://abc.supabase.co");
});

test('CSP permits no inline or eval escape hatch', () => {
  // 'unsafe-inline' would re-open the exact hole the policy exists to close.
  const headers = renderHeaders('https://abc.supabase.co');
  assert.equal(headers.includes('unsafe-inline'), false);
  assert.equal(headers.includes('unsafe-eval'), false);
});

test('the page can never be framed or made to submit itself elsewhere', () => {
  const headers = renderHeaders('https://abc.supabase.co');
  assert.ok(headers.includes("frame-ancestors 'none'"));
  assert.ok(headers.includes("form-action 'none'"));
});

test('camera and microphone are denied outright to the website', () => {
  // The scan happens in the app, never in a browser. Saying so in a header makes the
  // separation checkable rather than merely intended.
  const headers = renderHeaders('https://abc.supabase.co');
  assert.match(headers, /Permissions-Policy:.*camera=\(\)/);
  assert.match(headers, /Permissions-Policy:.*microphone=\(\)/);
});

// ── generated config ──────────────────────────────────────────────────────────
test('renderConfig emits the two values app.js reads', () => {
  const js = renderConfig('https://abc.supabase.co', 'anon-key');
  assert.ok(js.includes("supabaseUrl: 'https://abc.supabase.co'"));
  assert.ok(js.includes("supabaseAnonKey: 'anon-key'"));
});

test('renderConfig refuses values that would break out of the string literal', () => {
  // Config comes from the environment; a quote in it must fail loudly, not emit
  // syntactically valid JavaScript that does something else.
  assert.throws(() => renderConfig("https://x'+alert(1)+'", 'k'), /unsafe/i);
  assert.throws(() => renderConfig('https://x', "k'; alert(1); '"), /unsafe/i);
});
