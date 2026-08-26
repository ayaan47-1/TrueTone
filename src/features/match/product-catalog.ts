// src/features/match/product-catalog.ts
// Seed marketplace — brand-neutral, cosmetic-only names (CLAUDE.md §0). Enough variety in
// finish/shimmer/shade/undertone/category to exercise scoring, filters, and ranking.
import type { Product } from './match-types';

export const catalog: readonly Product[] = [
  { id: 'f-sheer-tint', name: 'Weightless Skin Tint', category: 'face', finish: 'sheer', hasShimmer: false, shade: 4, undertone: 'neutral', price: 22 },
  { id: 'f-satin-found', name: 'Soft Satin Foundation', category: 'face', finish: 'satin', hasShimmer: false, shade: 5, undertone: 'warm', price: 34 },
  { id: 'f-matte-found', name: 'Long-Wear Matte Foundation', category: 'face', finish: 'matte', hasShimmer: false, shade: 6, undertone: 'cool', price: 32 },
  { id: 'f-dewy-serum', name: 'Dewy Serum Foundation', category: 'face', finish: 'dewy', hasShimmer: false, shade: 3, undertone: 'warm', price: 38 },
  { id: 'f-glam-full', name: 'Full-Glam Foundation', category: 'face', finish: 'glam', hasShimmer: true, shade: 7, undertone: 'olive', price: 40 },
  { id: 'e-shimmer-quad', name: 'Shimmer Eye Quad', category: 'eyes', finish: 'glam', hasShimmer: true, shade: 5, undertone: 'warm', price: 28 },
  { id: 'e-matte-liner', name: 'Everyday Matte Liner', category: 'eyes', finish: 'matte', hasShimmer: false, shade: 5, undertone: 'neutral', price: 16 },
  { id: 'l-satin-lip', name: 'Satin Lip Color', category: 'lips', finish: 'satin', hasShimmer: false, shade: 5, undertone: 'warm', price: 18 },
  { id: 'l-dewy-balm', name: 'Dewy Tinted Balm', category: 'lips', finish: 'dewy', hasShimmer: false, shade: 4, undertone: 'cool', price: 14 },
  { id: 'p-prep-primer', name: 'Smoothing Prep Primer', category: 'prep', finish: 'natural', hasShimmer: false, shade: 5, undertone: 'neutral', price: 24 },
];
