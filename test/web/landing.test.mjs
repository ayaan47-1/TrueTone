import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectCategory } from '../../web/landing.js';

// Minimal stand-ins for the two category buttons and their panels. The switch is
// presentational only, so all it may touch is aria-pressed on buttons and hidden on panels.
function fakeButton(panelId, pressed) {
  const attrs = { 'aria-controls': panelId, 'aria-pressed': String(pressed) };
  return {
    getAttribute: (name) => attrs[name] ?? null,
    setAttribute: (name, value) => { attrs[name] = value; },
  };
}

function setup() {
  const panels = { skincare: { hidden: false }, makeup: { hidden: true } };
  const buttons = [fakeButton('skincare', true), fakeButton('makeup', false)];
  const lookup = (id) => panels[id] ?? null;
  return { panels, buttons, lookup };
}

test('choosing makeup presses its button and shows only its panel', () => {
  const { panels, buttons, lookup } = setup();
  selectCategory(buttons, buttons[1], lookup);
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'false');
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'true');
  assert.equal(panels.skincare.hidden, true);
  assert.equal(panels.makeup.hidden, false);
});

test('choosing the active category again leaves it selected', () => {
  const { panels, buttons, lookup } = setup();
  selectCategory(buttons, buttons[0], lookup);
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'true');
  assert.equal(panels.skincare.hidden, false);
  assert.equal(panels.makeup.hidden, true);
});

test('a button whose panel is missing does not throw', () => {
  const { buttons } = setup();
  assert.doesNotThrow(() => selectCategory(buttons, buttons[1], () => null));
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'true');
});

// ── mobile menu ───────────────────────────────────────────────────────────────
import { shouldCloseMenu } from '../../web/landing.js';

test('the mobile menu closes when a link inside it is chosen', () => {
  const link = { closest: (sel) => (sel === 'a' ? link : null) };
  assert.equal(shouldCloseMenu({ type: 'click', target: link }), true);
});

test('the mobile menu closes on Escape', () => {
  assert.equal(shouldCloseMenu({ type: 'keydown', key: 'Escape' }), true);
});

test('the mobile menu stays open for other clicks and keys', () => {
  const plain = { closest: () => null };
  assert.equal(shouldCloseMenu({ type: 'click', target: plain }), false);
  assert.equal(shouldCloseMenu({ type: 'keydown', key: 'Tab' }), false);
});
