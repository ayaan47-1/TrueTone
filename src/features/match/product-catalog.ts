// src/features/match/product-catalog.ts
// Synthetic demo marketplace — brand-neutral, cosmetic-only names (CLAUDE.md §0). This is
// LOCAL static data only: enough realistic foundations + concealers, across several invented
// (brand-neutral) product lines and the full warm/neutral/cool/olive undertone + fair-to-deep
// depth range, to make the Shop shelf feel populated on a device build with no backend. A few
// eyes/lips/prep items keep the Shop filter tabs from reading empty. The scoring boundary
// matches on `shade`/`undertone` only, so `shadeName`/`image` are inert display data and every
// consumer (ShopList + the match engine) reads this shape unchanged.
import type { Product } from './match-types';

// Stable placeholder thumbnail (no tracking; inert display data for a future Shop card image).
const img = (label: string): string =>
  `https://placehold.co/600x600/efe4d8/8a6d5b?text=${encodeURIComponent(label)}`;

export const catalog: readonly Product[] = [
  // --- Lumira line: everyday foundations across the tone range -----------------------------
  { id: 'lum-tint-01', name: 'Lumira Weightless Skin Tint', category: 'face', finish: 'sheer', hasShimmer: false, shade: 2, undertone: 'cool', price: 24, shadeName: 'Ivory 2C', image: img('Ivory 2C') },
  { id: 'lum-satin-02', name: 'Lumira Soft Satin Foundation', category: 'face', finish: 'satin', hasShimmer: false, shade: 3, undertone: 'warm', price: 34, shadeName: 'Sand 3W', image: img('Sand 3W') },
  { id: 'lum-matte-03', name: 'Lumira Long-Wear Matte Foundation', category: 'face', finish: 'matte', hasShimmer: false, shade: 5, undertone: 'neutral', price: 36, shadeName: 'Beige 5N', image: img('Beige 5N') },
  { id: 'lum-serum-04', name: 'Lumira Radiant Serum Foundation', category: 'face', finish: 'dewy', hasShimmer: false, shade: 7, undertone: 'warm', price: 38, shadeName: 'Amber 7W', image: img('Amber 7W') },

  // --- Solene line: luminous, second-skin foundations --------------------------------------
  { id: 'sol-second-05', name: 'Solene Second-Skin Foundation', category: 'face', finish: 'natural', hasShimmer: false, shade: 1, undertone: 'neutral', price: 32, shadeName: 'Porcelain 1N', image: img('Porcelain 1N') },
  { id: 'sol-tint-06', name: 'Solene Luminous Skin Tint', category: 'face', finish: 'sheer', hasShimmer: false, shade: 4, undertone: 'olive', price: 26, shadeName: 'Olive 4O', image: img('Olive 4O') },
  { id: 'sol-full-07', name: 'Solene Full-Cover Foundation', category: 'face', finish: 'matte', hasShimmer: false, shade: 6, undertone: 'cool', price: 35, shadeName: 'Praline 6C', image: img('Praline 6C') },
  { id: 'sol-silk-08', name: 'Solene Silk Glow Foundation', category: 'face', finish: 'dewy', hasShimmer: false, shade: 8, undertone: 'warm', price: 40, shadeName: 'Chestnut 8W', image: img('Chestnut 8W') },

  // --- Veranda line: reliable everyday foundations -----------------------------------------
  { id: 'ver-every-09', name: 'Veranda Everyday Foundation', category: 'face', finish: 'natural', hasShimmer: false, shade: 3, undertone: 'neutral', price: 30, shadeName: 'Nude 3N', image: img('Nude 3N') },
  { id: 'ver-velvet-10', name: 'Veranda Velvet Matte Foundation', category: 'face', finish: 'matte', hasShimmer: false, shade: 5, undertone: 'warm', price: 33, shadeName: 'Honey 5W', image: img('Honey 5W') },
  { id: 'ver-dewy-11', name: 'Veranda Dewy Finish Foundation', category: 'face', finish: 'dewy', hasShimmer: false, shade: 9, undertone: 'neutral', price: 37, shadeName: 'Mocha 9N', image: img('Mocha 9N') },

  // --- Auria line: balancing / comfort foundations, into the deep range --------------------
  { id: 'aur-tint-12', name: 'Auria Balancing Skin Tint', category: 'face', finish: 'sheer', hasShimmer: false, shade: 6, undertone: 'warm', price: 25, shadeName: 'Golden 6W', image: img('Golden 6W') },
  { id: 'aur-satin-13', name: 'Auria Satin Wear Foundation', category: 'face', finish: 'satin', hasShimmer: false, shade: 4, undertone: 'cool', price: 34, shadeName: 'Rose Beige 4C', image: img('Rose Beige 4C') },
  { id: 'aur-comfort-14', name: 'Auria Comfort Matte Foundation', category: 'face', finish: 'matte', hasShimmer: false, shade: 10, undertone: 'cool', price: 36, shadeName: 'Espresso 10C', image: img('Espresso 10C') },

  // --- Noora + Marlow lines: rounding out finish + undertone variety ------------------------
  { id: 'noo-serum-15', name: 'Noora Glow Serum Foundation', category: 'face', finish: 'dewy', hasShimmer: false, shade: 2, undertone: 'warm', price: 39, shadeName: 'Shell 2W', image: img('Shell 2W') },
  { id: 'mar-airy-16', name: 'Marlow Airy Satin Foundation', category: 'face', finish: 'satin', hasShimmer: false, shade: 7, undertone: 'olive', price: 34, shadeName: 'Sienna 7O', image: img('Sienna 7O') },

  // --- Concealers: brightening + full-cover, across the tone range --------------------------
  { id: 'lum-bright-17', name: 'Lumira Brightening Concealer', category: 'face', finish: 'natural', hasShimmer: false, shade: 2, undertone: 'neutral', price: 20, shadeName: 'Fair 2N', image: img('Fair 2N') },
  { id: 'lum-cover-18', name: 'Lumira Full-Cover Concealer', category: 'face', finish: 'matte', hasShimmer: false, shade: 5, undertone: 'warm', price: 22, shadeName: 'Honey 5W', image: img('Honey 5W') },
  { id: 'sol-radiant-19', name: 'Solene Radiant Concealer', category: 'face', finish: 'dewy', hasShimmer: false, shade: 3, undertone: 'cool', price: 21, shadeName: 'Ivory 3C', image: img('Ivory 3C') },
  { id: 'sol-wear-20', name: 'Solene Long-Wear Concealer', category: 'face', finish: 'matte', hasShimmer: false, shade: 7, undertone: 'warm', price: 23, shadeName: 'Amber 7W', image: img('Amber 7W') },
  { id: 'ver-smooth-21', name: 'Veranda Smoothing Concealer', category: 'face', finish: 'natural', hasShimmer: false, shade: 4, undertone: 'neutral', price: 19, shadeName: 'Sand 4N', image: img('Sand 4N') },
  { id: 'ver-undereye-22', name: 'Veranda Under-Eye Concealer', category: 'face', finish: 'satin', hasShimmer: false, shade: 6, undertone: 'warm', price: 20, shadeName: 'Golden 6W', image: img('Golden 6W') },
  { id: 'aur-focus-23', name: 'Auria Soft Focus Concealer', category: 'face', finish: 'natural', hasShimmer: false, shade: 8, undertone: 'neutral', price: 22, shadeName: 'Chestnut 8N', image: img('Chestnut 8N') },
  { id: 'aur-cover-24', name: 'Auria Matte Cover Concealer', category: 'face', finish: 'matte', hasShimmer: false, shade: 9, undertone: 'cool', price: 21, shadeName: 'Cocoa 9C', image: img('Cocoa 9C') },
  { id: 'noo-lumi-25', name: 'Noora Luminous Concealer', category: 'face', finish: 'dewy', hasShimmer: false, shade: 1, undertone: 'cool', price: 20, shadeName: 'Porcelain 1C', image: img('Porcelain 1C') },
  { id: 'mar-every-26', name: 'Marlow Everyday Concealer', category: 'face', finish: 'natural', hasShimmer: false, shade: 10, undertone: 'warm', price: 19, shadeName: 'Espresso 10W', image: img('Espresso 10W') },

  // --- A few Prep / Eyes / Lips items so the Shop filter tabs are never empty ---------------
  { id: 'ver-primer-27', name: 'Veranda Smoothing Prep Primer', category: 'prep', finish: 'natural', hasShimmer: false, shade: 5, undertone: 'neutral', price: 24, shadeName: 'Universal', image: img('Prep Primer') },
  { id: 'aur-primer-28', name: 'Auria Blur Setting Primer', category: 'prep', finish: 'matte', hasShimmer: false, shade: 5, undertone: 'neutral', price: 26, shadeName: 'Universal', image: img('Setting Primer') },
  { id: 'lum-lip-29', name: 'Lumira Satin Lip Color', category: 'lips', finish: 'satin', hasShimmer: false, shade: 5, undertone: 'warm', price: 18, shadeName: 'Rosewood', image: img('Rosewood Lip') },
  { id: 'sol-eye-30', name: 'Solene Shimmer Eye Quad', category: 'eyes', finish: 'glam', hasShimmer: true, shade: 5, undertone: 'warm', price: 28, shadeName: 'Bronze Glow', image: img('Bronze Quad') },
];
