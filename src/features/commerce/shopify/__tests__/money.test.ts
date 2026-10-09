import { addMoney, formatMoney, moneyToMinorUnits } from '../money';

describe('Shopify money rules', () => {
  it('converts decimal amounts without floating-point rounding', () => {
    expect(moneyToMinorUnits({ amount: '19.90', currencyCode: 'USD' })).toBe(1990);
    expect(moneyToMinorUnits({ amount: '19.999', currencyCode: 'USD' })).toBe(2000);
  });

  it('adds only like currencies', () => {
    expect(
      addMoney(
        { amount: '10.25', currencyCode: 'USD' },
        { amount: '2.50', currencyCode: 'USD' },
      ),
    ).toEqual({ amount: '12.75', currencyCode: 'USD' });
    expect(() =>
      addMoney(
        { amount: '1.00', currencyCode: 'USD' },
        { amount: '1.00', currencyCode: 'CAD' },
      ),
    ).toThrow('currency');
  });

  it('formats the API currency rather than assuming dollars', () => {
    expect(formatMoney({ amount: '12.50', currencyCode: 'USD' }, 'en-US')).toBe('$12.50');
  });
});
