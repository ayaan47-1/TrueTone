// src/features/shop/product-visual.ts
// Pure helpers behind ProductArt — the Quiet Glass v3 "drawn product" (ProductArt3 port).
// A product is shown as a simple shape (dropper / pump / tube / jar / stick / compact) in
// its own swatch colour over a pale backdrop, so the Shop needs no photography or remote
// images. A licensed local photo can replace the drawing per product (product-photos.ts).
import type { ImageSourcePropType } from 'react-native';
import type { Product } from '../match/match-types';
import type { ProductCategory } from '../../content/makeup-vocab';
import { PRODUCT_PHOTOS } from './product-photos';

export type ProductShape = 'dropper' | 'pump' | 'tube' | 'jar' | 'stick' | 'compact';

export interface ProductTone {
  /** Pale wash behind the drawing. */
  readonly backdrop: string;
  /** The product's own colour (its shade swatch — skin-tone data, never brand-shifted). */
  readonly product: string;
}

/** Warm mid-tone used when a product carries no swatch colour. */
const FALLBACK_PRODUCT = '#D9A579';

const BACKDROPS: Record<ProductCategory, string> = {
  face: '#F5E8DA',
  eyes: '#ECE7E1',
  lips: '#F8EEE7',
  prep: '#EAF1EC',
};

/** Which container shape to draw for a product. */
export function productShape(product: Product): ProductShape {
  switch (product.category) {
    case 'lips':
      return 'stick';
    case 'eyes':
      return 'compact';
    case 'prep':
      return 'jar';
    default:
      if (/concealer/i.test(product.name)) return 'tube';
      if (/tint/i.test(product.name)) return 'pump';
      return 'dropper';
  }
}

/** Backdrop + product colour for the drawing. */
export function productTone(product: Product): ProductTone {
  return { backdrop: BACKDROPS[product.category], product: product.color ?? FALLBACK_PRODUCT };
}

/** Splits "Lumira Weightless Skin Tint" into its line ("Lumira") and title. */
export function productLine(product: Product): { line: string; title: string } {
  const space = product.name.indexOf(' ');
  if (space < 0) return { line: '', title: product.name };
  return { line: product.name.slice(0, space), title: product.name.slice(space + 1) };
}

/** A licensed local photo for this product, if one is registered. */
export function productPhoto(
  id: string,
  registry: Readonly<Record<string, ImageSourcePropType>> = PRODUCT_PHOTOS,
): ImageSourcePropType | undefined {
  return registry[id];
}
