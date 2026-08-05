// DOM wiring for the unsubscribe page. Decisions live in waitlist-client.js.

import { buildLeaveRequest, parseToken, classifyResponse, messageFor, OUTCOMES } from '/waitlist-client.js';

const form = document.getElementById('leave-form');
const button = document.getElementById('submit');
const statusLine = document.getElementById('status');

function show(tone, text) {
  statusLine.textContent = text;
  statusLine.dataset.tone = tone;
}

const token = parseToken(window.location.search);
if (!token) {
  show('err', 'This unsubscribe link is missing or malformed. Use the link from your email.');
  button.disabled = true;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const config = window.TRUETONE_CONFIG;
  if (!token) return;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
    const { tone, text } = messageFor(OUTCOMES.CONFIG);
    show(tone, text);
    return;
  }

  button.disabled = true;
  show('', 'Removing you…');

  const { url, options } = buildLeaveRequest(config, token);
  try {
    const response = await fetch(url, options);
    if (classifyResponse(response.status) === OUTCOMES.OK) {
      show('ok', "Done — your email is gone. You won't hear from us again.");
      button.remove();
      return;
    }
    show('err', 'That did not go through and your email may still be on the list. Please try again.');
    button.disabled = false;
  } catch {
    const { tone, text } = messageFor(OUTCOMES.NETWORK);
    show(tone, text);
    button.disabled = false;
  }
});
