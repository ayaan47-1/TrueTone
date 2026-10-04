// Presentational category switch (opens on hover, focus or tap) for the brands band (Skincare / Makeup). No storage,
// no tracking, no network: it only flips aria-pressed on the buttons and hidden on the
// panels they control. The decision lives in selectCategory so it is unit tested
// (test/web/landing.test.mjs) without a DOM.

/** Press `chosen`, release the rest, and show only the chosen button's panel. */
export function selectCategory(buttons, chosen, lookup) {
  for (const button of buttons) {
    const active = button === chosen;
    button.setAttribute('aria-pressed', String(active));
    const panel = lookup(button.getAttribute('aria-controls'));
    if (panel) panel.hidden = !active;
  }
}

/** A category opens on hover (mouse or pen on a hover-capable device), on keyboard focus,
 *  and on click/tap — so touch screens without hover still work by tapping. */
export function shouldSelectOn(event, canHover) {
  if (event.type === 'click' || event.type === 'focus') return true;
  if (event.type === 'pointerenter') return canHover && event.pointerType !== 'touch';
  return false;
}

/** The no-JS <details> menu stays open after an in-page jump; close it when a link in
 *  it is chosen or Escape is pressed, so the panel stops covering the content. */
export function shouldCloseMenu(event) {
  if (event.type === 'keydown') return event.key === 'Escape';
  if (event.type === 'click') return Boolean(event.target?.closest?.('a'));
  return false;
}

if (typeof document !== 'undefined') {
  const buttons = [...document.querySelectorAll('[data-category]')];
  const lookup = (id) => (id ? document.getElementById(id) : null);
  const canHover = window.matchMedia?.('(hover: hover)').matches ?? false;
  // Hovering anywhere on the row (label or open panel) counts, not just the button.
  for (const button of buttons) {
    const open = (event) => {
      if (shouldSelectOn(event, canHover)) selectCategory(buttons, button, lookup);
    };
    button.addEventListener('click', open);
    button.addEventListener('focus', open);
    (button.closest('.ledger-row') ?? button).addEventListener('pointerenter', open);
  }

  const menu = document.querySelector('.menu');
  if (menu) {
    const close = (event) => {
      if (menu.open && shouldCloseMenu(event)) menu.open = false;
    };
    menu.addEventListener('click', close);
    menu.addEventListener('keydown', close);
  }
}
