// src/features/checkout/promo.ts
// Demo promo + bag totals from the v3 kit (V3Bag): TRUE15 takes 15% off, shipping is $5
// under $50. DEMO ONLY — there are no purchases in this build (DEMO_PROMO_LABEL shows beside
// it, per Dwight's v3 demo-content ruling). Display math in whole cents; nothing is charged.
export const PROMO_CODE = 'TRUE15';
const PROMO_RATE = 0.15;
const SHIPPING_CENTS = 500;
const FREE_SHIPPING_FROM_CENTS = 5000;

export function isPromoCode(code: string): boolean {
  return code.trim().toUpperCase() === PROMO_CODE;
}

export interface BagTotals {
  readonly subtotalCents: number;
  readonly discountCents: number;
  readonly shippingCents: number;
  /** How much more to spend for free shipping (0 once it's free). */
  readonly freeShippingGapCents: number;
  readonly totalCents: number;
}

/** Totals for a whole-USD subtotal, with or without the demo promo. Pure. */
export function bagTotals(subtotalUsd: number, promoApplied: boolean): BagTotals {
  const subtotalCents = Math.round(subtotalUsd * 100);
  const discountCents = promoApplied ? Math.round(subtotalCents * PROMO_RATE) : 0;
  const ships = subtotalCents > 0 && subtotalCents < FREE_SHIPPING_FROM_CENTS;
  const shippingCents = ships ? SHIPPING_CENTS : 0;
  return {
    subtotalCents,
    discountCents,
    shippingCents,
    freeShippingGapCents: ships ? FREE_SHIPPING_FROM_CENTS - subtotalCents : 0,
    totalCents: subtotalCents - discountCents + shippingCents,
  };
}

/** "$40.70" */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
