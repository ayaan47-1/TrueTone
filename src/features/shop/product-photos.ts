// src/features/shop/product-photos.ts
// Per-product photo registry. The catalog is a SAMPLE catalog (founder ruling 2026-09-29:
// AI photos are allowed everywhere, labelled once on the Shop as sample/demo content per
// Dwight's v3 demo-content ruling). The design kit ships eight AI product photos (p1–p8);
// each catalog product shows the one that matches its kind. All assets are bundled LOCAL
// files — never a remote URL, so product art renders offline and fetches nothing. Any id
// without an entry falls back to the drawn art in ProductArt.
import type { ImageSourcePropType } from 'react-native';
import type { Product } from '../match/match-types';
import { catalog } from '../match/product-catalog';

/** The kit's AI product photos, bundled from assets/photos/products/. */
export const KIT_PHOTOS = {
  p1: require('../../../assets/photos/products/p1.jpg'), // skin tint bottles
  p2: require('../../../assets/photos/products/p2.jpg'), // foundation dropper
  p3: require('../../../assets/photos/products/p3.jpg'), // cream blush jar
  p4: require('../../../assets/photos/products/p4.jpg'), // brow / line-up
  p5: require('../../../assets/photos/products/p5.jpg'), // tinted balm
  p6: require('../../../assets/photos/products/p6.jpg'), // eye palette
  p7: require('../../../assets/photos/products/p7.jpg'), // primer jar
  p8: require('../../../assets/photos/products/p8.jpg'), // concealer tube
} as const satisfies Record<string, ImageSourcePropType>;

export type KitPhotoKey = keyof typeof KIT_PHOTOS;

/** Which kit photo a product shows, by what the product is. */
export function photoKey(product: Product): KitPhotoKey {
  switch (product.category) {
    case 'lips':
      return 'p5';
    case 'eyes':
      return 'p6';
    case 'prep':
      return 'p7';
    default:
      if (/concealer/i.test(product.name)) return 'p8';
      if (/tint/i.test(product.name)) return 'p1';
      return 'p2';
  }
}

export const PRODUCT_PHOTOS: Readonly<Record<string, ImageSourcePropType>> = Object.freeze(
  Object.fromEntries(catalog.map((p) => [p.id, KIT_PHOTOS[photoKey(p)]])),
);

/** Look-alike stand-ins per kit photo, used when a neighbour already shows the first choice. */
const ALTERNATES: Readonly<Record<KitPhotoKey, readonly KitPhotoKey[]>> = {
  p1: ['p2', 'p8'],
  p2: ['p1', 'p8'],
  p3: ['p5', 'p7'],
  p4: ['p6', 'p3'],
  p5: ['p3', 'p8'],
  p6: ['p4', 'p3'],
  p7: ['p1', 'p2'],
  p8: ['p2', 'p1'],
};

/**
 * Kit photo per product for one displayed list (a grid read row by row, or a rail), so two
 * products side by side never share an image. Keeps each product's kind photo unless the
 * previous item already shows it. Deterministic: same list order, same photos.
 */
export function spreadPhotoKeys(products: readonly Product[]): KitPhotoKey[] {
  return products.reduce<KitPhotoKey[]>((keys, product) => {
    const prev = keys[keys.length - 1];
    const first = photoKey(product);
    const pick = first !== prev ? first : ALTERNATES[first].find((k) => k !== prev) ?? first;
    return [...keys, pick];
  }, []);
}
