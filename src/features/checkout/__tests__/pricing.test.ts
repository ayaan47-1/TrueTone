import { computeOrderTotalCents } from '../pricing';
import { catalog } from '../../match/product-catalog';

describe('computeOrderTotalCents', () => {
  it('computes correct total based on catalog prices, ignoring client tampered price', () => {
    // lum-tint-01 price is 24 in catalog
    const fakeClientPayload = [
      {
        product: { id: 'lum-tint-01', price: 1 }, // client claims price is 1
        qty: 2,
      },
    ];

    const totalCents = computeOrderTotalCents(fakeClientPayload);
    // 2 * $24 = $48 => 4800 cents
    expect(totalCents).toBe(4800);
  });

  it('throws on invalid item or missing product', () => {
    expect(() => computeOrderTotalCents([{ product: { id: 'fake-id' }, qty: 1 }])).toThrow();
    expect(() => computeOrderTotalCents([{ product: { id: 'lum-tint-01' }, qty: -1 }])).toThrow();
  });
});
