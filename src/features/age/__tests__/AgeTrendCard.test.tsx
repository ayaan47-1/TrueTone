// src/features/age/__tests__/AgeTrendCard.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { AgeTrendCard } from '../AgeTrendCard';
import { setEntitlementSource, localStubEntitlement } from '../../premium/entitlement';
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

test('shows an upsell and no trend when locked', async () => {
  setEntitlementSource(localStubEntitlement(false));
  await render(<AgeTrendCard history={history} skinAge={null} />);
  expect(screen.getByText(/unlock/i)).toBeTruthy();
  expect(screen.queryByText(/looks fresher/i)).toBeNull();
});

test('shows the freshness trend when unlocked', async () => {
  setEntitlementSource(localStubEntitlement(true));
  await render(<AgeTrendCard history={history} skinAge={null} />);
  expect(screen.getByText(/looks fresher/i)).toBeTruthy();
});

test('never shows an absolute age number while the flag is dark', async () => {
  setEntitlementSource(localStubEntitlement(true));
  await render(<AgeTrendCard history={history} skinAge={31} />);
  expect(screen.queryByText(/looks like ~?31/i)).toBeNull(); // dark: skinAge present but flag off
});
