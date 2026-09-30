// src/features/foryou/home-photos.ts
// Bundled LOCAL photos for the For You home (designer v3 kit, AI-generated; founder
// approved AI photos 2026-09-29). Never a remote URL — the home renders offline and
// fetches nothing. Product photos live elsewhere (shop/product-photos.ts).
import type { ImageSourcePropType } from 'react-native';

export const HOME_LOCKUP: ImageSourcePropType = require('../../../assets/photos/home/logo-lockup.png');

export const HERO_PHOTOS = {
  scan: require('../../../assets/photos/home/hero_scan.jpg') as ImageSourcePropType,
  look: require('../../../assets/photos/home/hero_look.jpg') as ImageSourcePropType,
  promo: require('../../../assets/photos/home/hero_promo.jpg') as ImageSourcePropType,
} as const;

export const CATEGORY_PHOTOS = {
  face: require('../../../assets/photos/home/cat_face.jpg') as ImageSourcePropType,
  eyes: require('../../../assets/photos/home/cat_eyes.jpg') as ImageSourcePropType,
  lips: require('../../../assets/photos/home/cat_lips.jpg') as ImageSourcePropType,
  cheeks: require('../../../assets/photos/home/cat_cheeks.jpg') as ImageSourcePropType,
} as const;
