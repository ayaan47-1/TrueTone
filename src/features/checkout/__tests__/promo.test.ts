// Demo promo + bag totals (kit V3Bag): TRUE15 = 15% off, $5 shipping under $50. Demo only —
// no purchases in this build — so this is display math in cents, never a charge.
import { bagTotals, isPromoCode, PROMO_CODE } from '../promo';

test('TRUE15 is the only accepted code, case/space-insensitive', () => {
  expect(PROMO_CODE).toBe('TRUE15');
  expect(isPromoCode(' true15 ')).toBe(true);
  expect(isPromoCode('TRUE20')).toBe(false);
  expect(isPromoCode('')).toBe(false);
});

test('matches the video frame: $42 with TRUE15 → −$6.30, $5 ship, $8 to free, $40.70', () => {
  expect(bagTotals(42, true)).toEqual({
    subtotalCents: 4200,
    discountCents: 630,
    shippingCents: 500,
    freeShippingGapCents: 800,
    totalCents: 4070,
  });
});

test('no promo = no discount; $50+ ships free; empty bag ships free', () => {
  expect(bagTotals(42, false).discountCents).toBe(0);
  expect(bagTotals(50, false)).toMatchObject({ shippingCents: 0, freeShippingGapCents: 0, totalCents: 5000 });
  expect(bagTotals(0, true)).toMatchObject({ shippingCents: 0, totalCents: 0 });
});
