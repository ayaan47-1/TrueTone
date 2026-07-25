import type { Dimension } from '../../src/content/cosmetic-vocab';

export interface AxisResult {
  name: string;
  pass: boolean;
  worst: { dimension: Dimension; value: number } | null;
  detail: Record<string, number>;
}
