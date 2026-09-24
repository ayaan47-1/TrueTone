// src/features/premium/entitlement.ts
// Gates DISPLAY of premium features (TrueTone Plus & age appearance).
// MUST NOT import scores, reads, or the image — billing never sees biometric/health data (CLAUDE.md §1/§3).
// Real RevenueCat / StoreKit adapter plugs in via setEntitlementSource without changing callers.

import { useState, useEffect } from 'react';

export type SubscriptionPlan = 'yearly' | 'monthly';
export type SubscriptionStatus = 'active' | 'trial' | 'past_due' | 'canceled' | 'expired' | 'none';

export interface EntitlementInfo {
  isPlusSubscriber: boolean;
  hasAgeAccess: boolean;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus;
  expiresAt?: string | null;
  isInTrial?: boolean;
}

export interface PurchaseResult {
  success: boolean;
  userCancelled?: boolean;
  error?: string;
  entitlement?: EntitlementInfo;
}

export interface EntitlementSource {
  hasAgeAccess(): boolean;
  hasPlusAccess(): boolean;
  getEntitlement(): Promise<EntitlementInfo> | EntitlementInfo;
  purchase(plan: SubscriptionPlan): Promise<PurchaseResult>;
  restorePurchases(): Promise<PurchaseResult>;
  subscribe?(listener: (info: EntitlementInfo) => void): () => void;
}

/** Local stub entitlement provider for tests, previews, and offline dev */
export function localStubEntitlement(
  enabled: boolean,
  initialPlan: SubscriptionPlan = 'yearly',
  initialStatus: SubscriptionStatus = enabled ? 'active' : 'none'
): EntitlementSource {
  let isSubscribed = enabled;
  let currentPlan: SubscriptionPlan | null = enabled ? initialPlan : null;
  let currentStatus: SubscriptionStatus = initialStatus;
  const listeners = new Set<(info: EntitlementInfo) => void>();

  const currentInfo = (): EntitlementInfo => ({
    isPlusSubscriber: isSubscribed,
    hasAgeAccess: isSubscribed,
    plan: currentPlan,
    status: currentStatus,
    isInTrial: currentStatus === 'trial',
    expiresAt: isSubscribed ? new Date(Date.now() + 30 * 86400000).toISOString() : null,
  });

  const notify = () => {
    const info = currentInfo();
    for (const l of listeners) l(info);
  };

  return {
    hasAgeAccess: () => isSubscribed,
    hasPlusAccess: () => isSubscribed,
    getEntitlement: () => currentInfo(),
    purchase: async (plan: SubscriptionPlan): Promise<PurchaseResult> => {
      isSubscribed = true;
      currentPlan = plan;
      currentStatus = plan === 'yearly' ? 'trial' : 'active';
      notify();
      return { success: true, entitlement: currentInfo() };
    },
    restorePurchases: async (): Promise<PurchaseResult> => {
      // In stub mode, restore succeeds with current state
      return { success: true, entitlement: currentInfo() };
    },
    subscribe: (listener: (info: EntitlementInfo) => void) => {
      listeners.add(listener);
      listener(currentInfo());
      return () => listeners.delete(listener);
    },
  };
}

/**
 * RevenueCat / App Store integration adapter template.
 * Designed to integrate with react-native-purchases when configured with an API key.
 * Fails closed safely if credentials are absent.
 */
export function createRevenueCatAdapter(config?: {
  apiKey?: string;
  appUserId?: string;
  entitlementId?: string;
}): EntitlementSource {
  const entitlementId = config?.entitlementId ?? 'plus';
  const apiKey = config?.apiKey;

  return {
    hasAgeAccess: () => false,
    hasPlusAccess: () => false,
    getEntitlement: async (): Promise<EntitlementInfo> => {
      if (!apiKey) {
        return {
          isPlusSubscriber: false,
          hasAgeAccess: false,
          plan: null,
          status: 'none',
        };
      }
      // Production integration call point:
      // const customerInfo = await Purchases.getCustomerInfo();
      // const ent = customerInfo.entitlements.active[entitlementId];
      return {
        isPlusSubscriber: false,
        hasAgeAccess: false,
        plan: null,
        status: 'none',
      };
    },
    purchase: async (plan: SubscriptionPlan): Promise<PurchaseResult> => {
      if (!apiKey) {
        return {
          success: false,
          error: 'Subscription service not configured (missing RevenueCat API key)',
        };
      }
      // Production integration call point:
      // const pkg = plan === 'yearly' ? offerings.current.annual : offerings.current.monthly;
      // const { customerInfo } = await Purchases.purchasePackage(pkg);
      return { success: false, error: 'Purchase unverified in sandbox' };
    },
    restorePurchases: async (): Promise<PurchaseResult> => {
      if (!apiKey) {
        return {
          success: false,
          error: 'Subscription service not configured (missing RevenueCat API key)',
        };
      }
      return { success: true };
    },
  };
}

let source: EntitlementSource = localStubEntitlement(false);

export function setEntitlementSource(src: EntitlementSource): void {
  source = src;
}

export function getEntitlementSource(): EntitlementSource {
  return source;
}

export function hasAgeAccess(): boolean {
  return source.hasAgeAccess();
}

export function hasPlusAccess(): boolean {
  return source.hasPlusAccess ? source.hasPlusAccess() : source.hasAgeAccess();
}

export async function getEntitlement(): Promise<EntitlementInfo> {
  if (source.getEntitlement) {
    return await Promise.resolve(source.getEntitlement());
  }
  const hasAccess = source.hasAgeAccess();
  return {
    isPlusSubscriber: hasAccess,
    hasAgeAccess: hasAccess,
    plan: hasAccess ? 'yearly' : null,
    status: hasAccess ? 'active' : 'none',
  };
}

export async function purchasePlan(plan: SubscriptionPlan): Promise<PurchaseResult> {
  if (source.purchase) {
    return await source.purchase(plan);
  }
  return { success: false, error: 'Purchase not supported by current entitlement source' };
}

export async function restorePurchases(): Promise<PurchaseResult> {
  if (source.restorePurchases) {
    return await source.restorePurchases();
  }
  return { success: false, error: 'Restore not supported by current entitlement source' };
}

/** React hook to subscribe to entitlement state */
export function useEntitlement(): EntitlementInfo {
  const [info, setInfo] = useState<EntitlementInfo>(() => {
    const hasAccess = source.hasAgeAccess();
    return {
      isPlusSubscriber: hasAccess,
      hasAgeAccess: hasAccess,
      plan: hasAccess ? 'yearly' : null,
      status: hasAccess ? 'active' : 'none',
    };
  });

  useEffect(() => {
    if (source.subscribe) {
      return source.subscribe((latest) => setInfo(latest));
    }
    // Fallback one-shot
    Promise.resolve(getEntitlement()).then(setInfo);
  }, []);

  return info;
}
