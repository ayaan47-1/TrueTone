// eval/fairness/fst.ts
export type Fitzpatrick = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';

export const FITZPATRICK: readonly Fitzpatrick[] = ['I', 'II', 'III', 'IV', 'V', 'VI'];

export function fstIndex(f: Fitzpatrick): number {
  return FITZPATRICK.indexOf(f) + 1; // 1..6
}

export function isFitzpatrick(v: unknown): v is Fitzpatrick {
  return typeof v === 'string' && (FITZPATRICK as readonly string[]).includes(v);
}
