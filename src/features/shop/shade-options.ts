// src/features/shop/shade-options.ts
// Shade picker options for the product page. The demo catalog lists one shade per face
// product, so the picker offers that shade plus the neighbouring depths (±2) in the same
// undertone, coloured with the catalog's own swatch ramp. The user's derived depth — the
// only scan input used, never the image — is flagged "Your match". Pure.
import type { MatchProfile, Product } from '../match/match-types';
import { getSwatchColor } from '../match/product-catalog';
import type { Undertone } from '../../content/makeup-vocab';

export interface ShadeOption {
  readonly label: string;
  readonly color: string;
  readonly isYourMatch: boolean;
  /** The shade this catalog product actually is. */
  readonly isProductShade: boolean;
}

const DEPTH_NAMES = ['Porcelain', 'Ivory', 'Sand', 'Beige', 'Honey', 'Golden', 'Amber', 'Chestnut', 'Mocha', 'Espresso'] as const;
const UNDERTONE_CODE: Record<Undertone, string> = { warm: 'W', cool: 'C', neutral: 'N', olive: 'O' };
const RANGE = 2;

const depthLabel = (depth: number, undertone: Undertone): string =>
  `${DEPTH_NAMES[depth - 1]} ${depth}${UNDERTONE_CODE[undertone]}`;

/** Picker options, lightest → deepest. */
export function shadeOptions(product: Product, profile?: MatchProfile): ShadeOption[] {
  if (product.category !== 'face') {
    return [{ label: product.shadeName ?? 'One shade', color: product.color ?? getSwatchColor(product.shade, product.undertone), isYourMatch: false, isProductShade: true }];
  }
  const from = Math.max(1, product.shade - RANGE);
  const to = Math.min(10, product.shade + RANGE);
  const options: ShadeOption[] = [];
  for (let depth = from; depth <= to; depth++) {
    options.push({
      label: depth === product.shade && product.shadeName ? product.shadeName : depthLabel(depth, product.undertone),
      color: getSwatchColor(depth, product.undertone),
      isYourMatch: profile !== undefined && profile.shade === depth,
      isProductShade: depth === product.shade,
    });
  }
  return options;
}

/** Pre-selected option: the user's match if present, else the product's own shade. */
export function defaultShadeIndex(options: readonly ShadeOption[]): number {
  const match = options.findIndex((o) => o.isYourMatch);
  if (match >= 0) return match;
  return Math.max(0, options.findIndex((o) => o.isProductShade));
}
