// src/features/premium/__tests__/entitlement.test.ts
import { hasAgeAccess, setEntitlementSource, localStubEntitlement } from '../entitlement';

describe('entitlement', () => {
  afterEach(() => setEntitlementSource(localStubEntitlement(false)));

  it('defaults to locked (no access)', () => {
    expect(hasAgeAccess()).toBe(false);
  });
  it('reflects the injected source', () => {
    setEntitlementSource(localStubEntitlement(true));
    expect(hasAgeAccess()).toBe(true);
    setEntitlementSource(localStubEntitlement(false));
    expect(hasAgeAccess()).toBe(false);
  });
  it('does not import scan/score/read modules (compliance isolation)', () => {
    const src = require('fs').readFileSync(require.resolve('../entitlement.ts'), 'utf8');
    expect(src).not.toMatch(/scans|read-types|skin-age|cosmetic-vocab/);
  });
});
