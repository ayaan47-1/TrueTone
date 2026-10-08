// src/features/shop/product-photos.ts
// Per-product photo registry. Only the four unbranded kit photos are eligible. All assets
// are bundled LOCAL files — never a remote URL, so product art renders offline and fetches
// nothing. Any product without an eligible entry falls back to the drawn art in ProductArt.
import type { ImageSourcePropType } from 'react-native';
import type { Product } from '../match/match-types';
import { catalog } from '../match/product-catalog';

/** The eligible unbranded product photos bundled from assets/photos/products/. */
export const KIT_PHOTOS = {
  p2: require('../../../assets/photos/products/p2.jpg'), // foundation dropper
  p5: require('../../../assets/photos/products/p5.jpg'), // tinted balm
  p6: require('../../../assets/photos/products/p6.jpg'), // eye palette
  p7: require('../../../assets/photos/products/p7.jpg'), // primer jar
} as const satisfies Record<string, ImageSourcePropType>;

export type KitPhotoKey = keyof typeof KIT_PHOTOS;

/** Which eligible kit photo a product shows, if one matches its kind. */
export function photoKey(product: Product): KitPhotoKey | undefined {
  switch (product.category) {
    case 'lips':
      return 'p5';
    case 'eyes':
      return 'p6';
    case 'prep':
      return 'p7';
    default:
      return /foundation/i.test(product.name) ? 'p2' : undefined;
  }
}

export const PRODUCT_PHOTOS: Readonly<Record<string, ImageSourcePropType>> = Object.freeze(
  Object.fromEntries(
    catalog.flatMap((product) => {
      const key = photoKey(product);
      return key === undefined ? [] : [[product.id, KIT_PHOTOS[key]] as const];
    }),
  ),
);

/** Look-alike stand-ins per kit photo, used when a neighbour already shows the first choice. */
const ALTERNATES: Readonly<Record<KitPhotoKey, readonly KitPhotoKey[]>> = {
  p2: ['p7', 'p5', 'p6'],
  p5: ['p7', 'p6', 'p2'],
  p6: ['p5', 'p7', 'p2'],
  p7: ['p2', 'p5', 'p6'],
};

/**
 * Kit photo per product for one displayed list (a grid read row by row, or a rail), so two
 * products side by side never share an image. Keeps each product's kind photo unless the
 * previous item already shows it. Deterministic: same list order, same photos.
 */
export function spreadPhotoKeys(products: readonly Product[]): (KitPhotoKey | undefined)[] {
  return products.reduce<(KitPhotoKey | undefined)[]>((keys, product) => {
    const prev = keys[keys.length - 1];
    const first = photoKey(product);
    if (first === undefined) return [...keys, undefined];
    const pick = first !== prev ? first : ALTERNATES[first].find((k) => k !== prev) ?? first;
    return [...keys, pick];
  }, []);
}
