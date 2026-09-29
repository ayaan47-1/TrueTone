// src/features/shop/product-photos.ts
// Per-product photo registry. EMPTY on purpose: no product photography ships until its
// licence is on file (design review F2). To add one, drop a licensed LOCAL asset in
// assets/ and map it here, e.g. `'lum-tint-01': require('../../../assets/products/lum-tint-01.jpg')`.
// Never a remote URL — product art must render offline and fetch nothing.
import type { ImageSourcePropType } from 'react-native';

export const PRODUCT_PHOTOS: Readonly<Record<string, ImageSourcePropType>> = {};
