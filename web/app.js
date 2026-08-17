// DOM wiring for the waitlist form. Everything with a decision in it lives in
// waitlist-client.js and is unit tested; this file only moves values between the form,
// that module, and the status line.

import { buildRequest, classifyResponse, messageFor, OUTCOMES, parsePhone } from '/waitlist-client.js';

const form = document.getElementById('waitlist-form');
const emailField = document.getElementById('email');
const phoneField = document.getElementById('phone');
const attestField = document.getElementById('attest');
const smsConsentField = document.getElementById('sms-consent');
const button = document.getElementById('submit');
const statusLine = document.getElementById('status');

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

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!emailField.checkValidity() || !emailField.value.trim()) {
    show('err', 'Enter an email address we can reach you at.');
    emailField.focus();
    return;
  }
  if (!attestField.checked) {
    // The 18+/US attestation gates the whole product (CLAUDE.md §1), so it is not
    // optional here either — and the RPC refuses a signup without it regardless.
    show('err', 'Please confirm you are 18 or older and in the United States.');
    attestField.focus();
    return;
  }

  const phone = parsePhone(phoneField.value);
  if (smsConsentField.checked && phone.status !== 'ok') {
    // Only complain when they asked for texts. An unticked box means the field is
    // decoration and a stray character in it must not block the signup.
    //
    // parsePhone returns three states, not a nullable string, precisely so the two
    // failures can be worded honestly: an empty field is a missing answer, not a wrong one.
    show('err', phone.status === 'blank'
      ? 'Add a phone number, or untick the text option.'
      : "That doesn't look like a US mobile number. Check it, or untick the text option.");
    phoneField.focus();
    return;
  }

  const config = readConfig();
  if (!config) {
    showOutcome(OUTCOMES.CONFIG);
    return;
  }

  button.disabled = true;
  show('', 'Adding you…');

  // buildRequest is the only path that decides whether the number is transmitted: it
  // re-parses and sends null unless consent is ticked AND the number is well-formed.
  const { url, options } = buildRequest(config, {
    email: emailField.value,
    phone: phoneField.value,
    smsConsent: smsConsentField.checked,
  });
  try {
    const response = await fetch(url, options);
    const outcome = classifyResponse(response.status);
    const { tone, text } = messageFor(outcome, { sms: smsConsentField.checked && phone.status === 'ok' });
    show(tone, text);
    if (outcome === OUTCOMES.OK) form.reset();
  } catch {
    // fetch only rejects on a transport failure; every HTTP status is handled above.
    showOutcome(OUTCOMES.NETWORK);
  } finally {
    button.disabled = false;
  }
});
