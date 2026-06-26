// src/features/age/__tests__/AgeTrendCard-hardened.test.tsx
// Covers the absolute-age triple-gating and the showAbsolute branch (lines 23-28).
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { AgeTrendCard } from '../AgeTrendCard';
import { setEntitlementSource, localStubEntitlement } from '../../premium/entitlement';
import { SKIN_AGE_ABSOLUTE_ENABLED } from '../age-flags';
import { DIMENSIONS } from '../../../content/cosmetic-vocab';
import type { ScoreVector } from '../../read/read-types';

const vec = (f: number): ScoreVector => Object.fromEntries(DIMENSIONS.map((d) => [d, f])) as ScoreVector;
const history = [
  { capturedAt: '2026-06-10', scores: { ...vec(0.2), hydration: 0.9 } },
  { capturedAt: '2026-06-01', scores: { ...vec(0.6), hydration: 0.3 } },
];

afterEach(() => {
  setEntitlementSource(localStubEntitlement(false));
});

// ─── 1. Flag check ────────────────────────────────────────────────────────────

test('SKIN_AGE_ABSOLUTE_ENABLED is false (validation gate enforced)', () => {
  expect(SKIN_AGE_ABSOLUTE_ENABLED).toBe(false);
});

// ─── 2. Absolute number stays dark while flag is false ────────────────────────

test('skinAge={31} is NOT rendered while SKIN_AGE_ABSOLUTE_ENABLED is false', async () => {
  setEntitlementSource(localStubEntitlement(true));
  await render(<AgeTrendCard history={history} skinAge={31} />);
  // The absolute age number must not appear in any form
  expect(screen.queryByText(/31/)).toBeNull();
  expect(screen.queryByText(/looks like/i)).toBeNull();
});

test('skinAge={0} is NOT rendered while SKIN_AGE_ABSOLUTE_ENABLED is false', async () => {
  setEntitlementSource(localStubEntitlement(true));
  await render(<AgeTrendCard history={history} skinAge={0} />);
  expect(screen.queryByText(/looks like ~?0/i)).toBeNull();
});

test('skinAge={null} with flag false → no absolute copy rendered', async () => {
  setEntitlementSource(localStubEntitlement(true));
  await render(<AgeTrendCard history={history} skinAge={null} />);
  expect(screen.queryByText(/looks like/i)).toBeNull();
});

// ─── 3. showAbsolute branch: when flag IS on, absolute renders (lines 23-28) ─

test('skinAge renders when SKIN_AGE_ABSOLUTE_ENABLED is true (flag-on path)', async () => {
  // This covers AgeTrendCard.tsx:23-28 (showAbsolute = true branch).
  // We must re-require ALL relevant modules after resetModules so they share the same
  // module registry; in particular, entitlement must be set on the fresh singleton.
  jest.resetModules();
  jest.doMock('../age-flags', () => ({ SKIN_AGE_ABSOLUTE_ENABLED: true }));
  const { AgeTrendCard: AgeTrendCardFlagged } = require('../AgeTrendCard') as typeof import('../AgeTrendCard');
  const { setEntitlementSource: setFresh, localStubEntitlement: localFresh } =
    require('../../premium/entitlement') as typeof import('../../premium/entitlement');
  setFresh(localFresh(true));
  await render(<AgeTrendCardFlagged history={history} skinAge={31} />);
  expect(screen.getByText(/looks like ~31/i)).toBeTruthy();
  jest.dontMock('../age-flags');
  jest.resetModules();
});

test('skinAge null with flag enabled → absolute section still hidden (null guard)', async () => {
  jest.resetModules();
  jest.doMock('../age-flags', () => ({ SKIN_AGE_ABSOLUTE_ENABLED: true }));
  const { AgeTrendCard: AgeTrendCardFlagged } = require('../AgeTrendCard') as typeof import('../AgeTrendCard');
  const { setEntitlementSource: setFresh, localStubEntitlement: localFresh } =
    require('../../premium/entitlement') as typeof import('../../premium/entitlement');
  setFresh(localFresh(true));
  await render(<AgeTrendCardFlagged history={history} skinAge={null} />);
  expect(screen.queryByText(/looks like/i)).toBeNull();
  jest.dontMock('../age-flags');
  jest.resetModules();
});

// ─── 4. The disclaimer text is always present (cosmetic framing) ──────────────

test('disclaimer copy is always shown to unlocked users', async () => {
  setEntitlementSource(localStubEntitlement(true));
  await render(<AgeTrendCard history={history} skinAge={null} />);
  expect(
    screen.getByText(/not a medical or biological age/i),
  ).toBeTruthy();
});

test('the engine returns null while flag is dark (estimateSkinAge)', () => {
  // Triple-gate: engine itself returns null.
  jest.resetModules();
  const { estimateSkinAge } = require('../skin-age-engine') as typeof import('../skin-age-engine');
  const read = {
    scores: vec(0.5),
    skinType: 'combination' as const,
    modelVersion: 'stub-1',
    isStub: true,
  };
  expect(estimateSkinAge(read)).toBeNull();
  jest.resetModules();
});
