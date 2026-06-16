// src/features/read/bands.ts
import { BAND_LABELS, type Dimension } from '../../content/cosmetic-vocab';

export type Band = { index: 0 | 1 | 2; label: string };
export type Direction = 'up' | 'down' | 'same';

export function toBand(dim: Dimension, value: number): Band {
  const v = Math.min(1, Math.max(0, value));
  const index: 0 | 1 | 2 = v < 1 / 3 ? 0 : v < 2 / 3 ? 1 : 2;
  return { index, label: BAND_LABELS[dim][index] };
}

export function direction(curr: number, prev: number | null, eps = 0.05): Direction {
  if (prev === null) return 'same';
  if (curr - prev > eps) return 'up';
  if (prev - curr > eps) return 'down';
  return 'same';
}
