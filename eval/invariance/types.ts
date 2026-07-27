import type { Dimension } from '../../src/content/cosmetic-vocab';

export interface AxisBreach {
  key: string;
  value: number;
  limit: number;
}

export interface AxisResult {
  name: string;
  pass: boolean;
  worst: { dimension: Dimension; value: number } | null;
  detail: Record<string, number>;
  breaches: AxisBreach[];
}
