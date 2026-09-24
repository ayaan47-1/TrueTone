// src/features/premium/__tests__/entitlement.test.ts
import {
  hasAgeAccess,
  hasPlusAccess,
  setEntitlementSource,
  localStubEntitlement,
  getEntitlement,
  purchasePlan,
  restorePurchases,
  createRevenueCatAdapter,
} from '../entitlement';

describe('entitlement', () => {
  afterEach(() => setEntitlementSource(localStubEntitlement(false)));

  it('defaults to locked (no access)', () => {
    expect(hasAgeAccess()).toBe(false);
    expect(hasPlusAccess()).toBe(false);
  });

  it('reflects the injected source', () => {
    setEntitlementSource(localStubEntitlement(true));
    expect(hasAgeAccess()).toBe(true);
    expect(hasPlusAccess()).toBe(true);
    setEntitlementSource(localStubEntitlement(false));
    expect(hasAgeAccess()).toBe(false);
    expect(hasPlusAccess()).toBe(false);
  });

  it('returns entitlement details via getEntitlement', async () => {
    setEntitlementSource(localStubEntitlement(true, 'yearly', 'trial'));
    const ent = await getEntitlement();
    expect(ent.isPlusSubscriber).toBe(true);
    expect(ent.hasAgeAccess).toBe(true);
    expect(ent.plan).toBe('yearly');
    expect(ent.status).toBe('trial');
    expect(ent.isInTrial).toBe(true);
  });

  it('purchases yearly plan and unlocks plus access', async () => {
    const stub = localStubEntitlement(false);
    setEntitlementSource(stub);
    expect(hasPlusAccess()).toBe(false);

    const res = await purchasePlan('yearly');
    expect(res.success).toBe(true);
    expect(hasPlusAccess()).toBe(true);
    expect(hasAgeAccess()).toBe(true);

    const ent = await getEntitlement();
    expect(ent.isPlusSubscriber).toBe(true);
    expect(ent.plan).toBe('yearly');
    expect(ent.isInTrial).toBe(true);
  });

  it('purchases monthly plan and unlocks active subscription', async () => {
    const stub = localStubEntitlement(false);
    setEntitlementSource(stub);

    const res = await purchasePlan('monthly');
    expect(res.success).toBe(true);
    expect(hasPlusAccess()).toBe(true);

    const ent = await getEntitlement();
    expect(ent.isPlusSubscriber).toBe(true);
    expect(ent.plan).toBe('monthly');
    expect(ent.status).toBe('active');
    expect(ent.isInTrial).toBe(false);
  });

  it('restores purchases successfully in stub mode', async () => {
    const stub = localStubEntitlement(true, 'yearly');
    setEntitlementSource(stub);

    const res = await restorePurchases();
    expect(res.success).toBe(true);
    expect(res.entitlement?.isPlusSubscriber).toBe(true);
  });

  it('notifies subscribers on purchase', async () => {
    const stub = localStubEntitlement(false);
    setEntitlementSource(stub);

    const received: boolean[] = [];
    const unsub = stub.subscribe!((info) => {
      received.push(info.isPlusSubscriber);
    });

    await purchasePlan('yearly');
    unsub();

    expect(received).toEqual([false, true]);
  });

  it('RevenueCat adapter fails closed when unconfigured (no API key)', async () => {
    const rc = createRevenueCatAdapter();
    setEntitlementSource(rc);

    expect(hasAgeAccess()).toBe(false);
    expect(hasPlusAccess()).toBe(false);

    const ent = await getEntitlement();
    expect(ent.isPlusSubscriber).toBe(false);

    const purchase = await purchasePlan('yearly');
    expect(purchase.success).toBe(false);
    expect(purchase.error).toContain('missing RevenueCat API key');
  });

  it('does not import scan/score/read modules (compliance isolation)', () => {
    const src = require('fs').readFileSync(require.resolve('../entitlement.ts'), 'utf8');
    expect(src).not.toMatch(/scans|read-types|skin-age|cosmetic-vocab/);
  });
});
