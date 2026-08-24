// DOM wiring for the waitlist form. Everything with a decision in it lives in
// waitlist-client.js and is unit tested; this file only moves values between the form,
// that module, the status line, and the referral/share UI.

import {
  buildRequest,
  buildCountRequest,
  parseCount,
  classifyResponse,
  messageFor,
  OUTCOMES,
  parseReferral,
  captureSource,
  parseJoinResult,
  buildShareLink,
  formatPosition,
} from '/waitlist-client.js';

const form = document.getElementById('waitlist-form');
const emailField = document.getElementById('email');
const attestField = document.getElementById('attest');
const button = document.getElementById('submit');
const statusLine = document.getElementById('status');
const refBanner = document.getElementById('ref-banner');
const counterEl = document.getElementById('waitlist-count');

const sharePanel = document.getElementById('share');
const positionEl = document.getElementById('position');
const shareLinkEl = document.getElementById('share-link');
const copyButton = document.getElementById('copy-link');
const referralsEl = document.getElementById('referrals');

const numberFmt = new Intl.NumberFormat('en-US');

function show(tone, text) {
  statusLine.textContent = text;
  statusLine.dataset.tone = tone;
}

function showOutcome(outcome) {
  const { tone, text } = messageFor(outcome);
  show(tone, text);
}

/** The build step writes web/config.js from the environment. If it is missing or still
 *  holds the example values, say so plainly rather than letting the form look functional
 *  and quietly drop signups. */
function readConfig() {
  const cfg = window.TRUETONE_CONFIG;
  if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) return null;
  if (cfg.supabaseUrl.includes('YOUR-PROJECT')) return null;
  return cfg;
}

// A referral code arriving in ?ref is attribution only — the RPC re-validates it and
// silently drops an unknown one, so a bad link can never block a signup. It is captured
// once here and sent with the join request.
const referredBy = parseReferral(window.location.search);
if (referredBy && refBanner) refBanner.hidden = false;

/** Populate the live counter. waitlist_count() returns an aggregate total only, so this
 *  never exposes the list — and if it fails, the placeholder just stays put. */
async function loadCounter(config) {
  if (!config || !counterEl) return;
  try {
    const { url, options } = buildCountRequest(config);
    const response = await fetch(url, options);
    if (!response.ok) return;
    const total = parseCount(await response.json());
    if (total !== null) counterEl.textContent = numberFmt.format(total);
  } catch {
    // A counter that can't load is cosmetic; never let it break the page.
  }
}

/** Reveal the visitor's own invite link and spot in line after a successful join. */
function showShare(result) {
  if (!result || !sharePanel) return;
  const link = buildShareLink(window.location.origin, result.code);
  if (shareLinkEl) shareLinkEl.value = link;
  if (positionEl) positionEl.textContent = formatPosition(result);
  if (referralsEl) referralsEl.textContent = numberFmt.format(result.referrals ?? 0);
  if (result.total !== null && counterEl) counterEl.textContent = numberFmt.format(result.total);
  sharePanel.hidden = false;
  sharePanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

if (copyButton && shareLinkEl) {
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareLinkEl.value);
      copyButton.textContent = 'copied';
      setTimeout(() => { copyButton.textContent = 'copy'; }, 2000);
    } catch {
      // Clipboard denied (or unavailable): fall back to selecting the text so the
      // visitor can copy it by hand.
      shareLinkEl.focus();
      shareLinkEl.select();
    }
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!emailField.checkValidity() || !emailField.value.trim()) {
    show('err', 'enter an email address we can reach you at.');
    emailField.focus();
    return;
  }
  if (!attestField.checked) {
    // The 18+/US attestation gates the whole product (CLAUDE.md §1), so it is not
    // optional here either — and the RPC refuses a signup without it regardless.
    show('err', 'please confirm you are 18 or older and in the united states.');
    attestField.focus();
    return;
  }

  const config = readConfig();
  if (!config) {
    showOutcome(OUTCOMES.CONFIG);
    return;
  }

  button.disabled = true;
  show('', 'adding you…');

  const { url, options } = buildRequest(config, {
    email: emailField.value,
    referredBy,
    source: captureSource(window.location.search, document.referrer),
  });
  try {
    const response = await fetch(url, options);
    const outcome = classifyResponse(response.status);
    showOutcome(outcome);
    if (outcome === OUTCOMES.OK) {
      // The RPC returns the caller's own row (code/position/total/referrals). Parse it to
      // draw the share link; parseJoinResult returns null on a 204 or an odd shape, in
      // which case we still confirmed the join but simply skip the share UI.
      let result = null;
      try {
        result = parseJoinResult(await response.json());
      } catch {
        result = null;
      }
      if (result) showShare(result);
    }
  } catch {
    // fetch only rejects on a transport failure; every HTTP status is handled above.
    showOutcome(OUTCOMES.NETWORK);
  } finally {
    button.disabled = false;
  }
});

loadCounter(readConfig());
