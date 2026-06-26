// src/features/premium/entitlement.ts
// Gates DISPLAY of premium age features only. MUST NOT import scores, reads, or the image — billing
// never sees biometric/health data (CLAUDE.md §1/§3). Real RevenueCat adapter plugs in via
// setEntitlementSource without changing callers.
export interface EntitlementSource {
  hasAgeAccess(): boolean;
}

export function localStubEntitlement(enabled: boolean): EntitlementSource {
  return { hasAgeAccess: () => enabled };
}

let source: EntitlementSource = localStubEntitlement(false);

export function setEntitlementSource(src: EntitlementSource): void {
  source = src;
}

export function hasAgeAccess(): boolean {
  return source.hasAgeAccess();
}
