import type { Money } from './types';

function parseMinorUnits(amount: string): bigint {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match) throw new Error(`Invalid money amount: ${amount}`);
  const fraction = (match[2] ?? '').padEnd(3, '0');
  let cents = BigInt(match[1]) * 100n + BigInt(fraction.slice(0, 2));
  if (Number(fraction[2]) >= 5) cents += 1n;
  return cents;
}

export function moneyToMinorUnits(money: Money): number {
  const minor = parseMinorUnits(money.amount);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Money amount is too large');
  return Number(minor);
}

export function addMoney(left: Money, right: Money): Money {
  if (left.currencyCode !== right.currencyCode) throw new Error('currency mismatch');
  const total = parseMinorUnits(left.amount) + parseMinorUnits(right.amount);
  return {
    amount: `${total / 100n}.${(total % 100n).toString().padStart(2, '0')}`,
    currencyCode: left.currencyCode,
  };
}

export function formatMoney(money: Money, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currencyCode,
  }).format(Number(money.amount));
}
