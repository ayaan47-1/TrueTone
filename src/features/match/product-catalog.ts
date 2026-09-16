// src/features/match/product-catalog.ts
// Synthetic demo marketplace — brand-neutral, cosmetic-only names (CLAUDE.md §0). This is
// LOCAL static data only: enough realistic foundations + concealers, across several invented
// (brand-neutral) product lines and the full warm/neutral/cool/olive undertone + fair-to-deep
// depth range, to make the Shop shelf feel populated on a device build with no backend. A few
// eyes/lips/prep items keep the Shop filter tabs from reading empty. The scoring boundary
// matches on `shade`/`undertone` only, so `shadeName`/`color` are inert display data and every
// consumer (ShopList + the match engine) reads this shape unchanged.
import type { Product } from './match-types';

// Generates a distinct HSL color string for a given shade depth (1-10) and undertone.
// Deep shades (9, 10) have increased saturation to remain visually distinct.
const getSwatchColor = (shade: number, undertone: string): string => {
  // Real deep foundation shades sit nearer L=20-25%; 15% reads close to black.
  // We ramp from L=82% (Shade 1) to L=22% (Shade 10).
  const lightness = 82 - (shade - 1) * (60 / 9);
  let hue = 25;
  let saturation = 40;

  if (undertone === 'cool') { hue = 12; saturation = 45; }
  else if (undertone === 'neutral') { hue = 25; saturation = 35; }
  else if (undertone === 'warm') { hue = 35; saturation = 50; }
  else if (undertone === 'olive') { hue = 45; saturation = 45; }

  if (shade >= 8) saturation += 10;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export const catalog: readonly Product[] = [
  // --- Lumira line: everyday foundations across the tone range -----------------------------
  { id: 'lum-tint-01', name: 'Lumira Weightless Skin Tint', category: 'face', finish: 'sheer', hasShimmer: false, shade: 2, undertone: 'cool', price: 24, shadeName: 'Ivory 2C', color: getSwatchColor(2, 'cool') },
  { id: 'lum-satin-02', name: 'Lumira Soft Satin Foundation', category: 'face', finish: 'satin', hasShimmer: false, shade: 3, undertone: 'warm', price: 34, shadeName: 'Sand 3W', color: getSwatchColor(3, 'warm') },
  { id: 'lum-matte-03', name: 'Lumira Long-Wear Matte Foundation', category: 'face', finish: 'matte', hasShimmer: false, shade: 5, undertone: 'neutral', price: 36, shadeName: 'Beige 5N', color: getSwatchColor(5, 'neutral') },
  { id: 'lum-serum-04', name: 'Lumira Radiant Serum Foundation', category: 'face', finish: 'dewy', hasShimmer: false, shade: 7, undertone: 'warm', price: 38, shadeName: 'Amber 7W', color: getSwatchColor(7, 'warm') },

  // --- Solene line: luminous, second-skin foundations --------------------------------------
  { id: 'sol-second-05', name: 'Solene Second-Skin Foundation', category: 'face', finish: 'natural', hasShimmer: false, shade: 1, undertone: 'neutral', price: 32, shadeName: 'Porcelain 1N', color: getSwatchColor(1, 'neutral') },
  { id: 'sol-tint-06', name: 'Solene Luminous Skin Tint', category: 'face', finish: 'sheer', hasShimmer: false, shade: 4, undertone: 'olive', price: 26, shadeName: 'Olive 4O', color: getSwatchColor(4, 'olive') },
  { id: 'sol-full-07', name: 'Solene Full-Cover Foundation', category: 'face', finish: 'matte', hasShimmer: false, shade: 6, undertone: 'cool', price: 35, shadeName: 'Praline 6C', color: getSwatchColor(6, 'cool') },
  { id: 'sol-silk-08', name: 'Solene Silk Glow Foundation', category: 'face', finish: 'dewy', hasShimmer: false, shade: 8, undertone: 'warm', price: 40, shadeName: 'Chestnut 8W', color: getSwatchColor(8, 'warm') },

  // --- Veranda line: reliable everyday foundations -----------------------------------------
  { id: 'ver-every-09', name: 'Veranda Everyday Foundation', category: 'face', finish: 'natural', hasShimmer: false, shade: 3, undertone: 'neutral', price: 30, shadeName: 'Nude 3N', color: getSwatchColor(3, 'neutral') },
  { id: 'ver-velvet-10', name: 'Veranda Velvet Matte Foundation', category: 'face', finish: 'matte', hasShimmer: false, shade: 5, undertone: 'warm', price: 33, shadeName: 'Honey 5W', color: getSwatchColor(5, 'warm') },
  { id: 'ver-dewy-11', name: 'Veranda Dewy Finish Foundation', category: 'face', finish: 'dewy', hasShimmer: false, shade: 9, undertone: 'neutral', price: 37, shadeName: 'Mocha 9N', color: getSwatchColor(9, 'neutral') },

  // --- Auria line: balancing / comfort foundations, into the deep range --------------------
  { id: 'aur-tint-12', name: 'Auria Balancing Skin Tint', category: 'face', finish: 'sheer', hasShimmer: false, shade: 6, undertone: 'warm', price: 25, shadeName: 'Golden 6W', color: getSwatchColor(6, 'warm') },
  { id: 'aur-satin-13', name: 'Auria Satin Wear Foundation', category: 'face', finish: 'satin', hasShimmer: false, shade: 4, undertone: 'cool', price: 34, shadeName: 'Rose Beige 4C', color: getSwatchColor(4, 'cool') },
  { id: 'aur-comfort-14', name: 'Auria Comfort Matte Foundation', category: 'face', finish: 'matte', hasShimmer: false, shade: 10, undertone: 'cool', price: 36, shadeName: 'Espresso 10C', color: getSwatchColor(10, 'cool') },

  // --- Noora + Marlow lines: rounding out finish + undertone variety ------------------------
  { id: 'noo-serum-15', name: 'Noora Glow Serum Foundation', category: 'face', finish: 'dewy', hasShimmer: false, shade: 2, undertone: 'warm', price: 39, shadeName: 'Shell 2W', color: getSwatchColor(2, 'warm') },
  { id: 'mar-airy-16', name: 'Marlow Airy Satin Foundation', category: 'face', finish: 'satin', hasShimmer: false, shade: 7, undertone: 'olive', price: 34, shadeName: 'Sienna 7O', color: getSwatchColor(7, 'olive') },

  // --- Concealers: brightening + full-cover, across the tone range --------------------------
  { id: 'lum-bright-17', name: 'Lumira Brightening Concealer', category: 'face', finish: 'natural', hasShimmer: false, shade: 2, undertone: 'neutral', price: 20, shadeName: 'Fair 2N', color: getSwatchColor(2, 'neutral') },
  { id: 'lum-cover-18', name: 'Lumira Full-Cover Concealer', category: 'face', finish: 'matte', hasShimmer: false, shade: 5, undertone: 'warm', price: 22, shadeName: 'Honey 5W', color: getSwatchColor(5, 'warm') },
  { id: 'sol-radiant-19', name: 'Solene Radiant Concealer', category: 'face', finish: 'dewy', hasShimmer: false, shade: 3, undertone: 'cool', price: 21, shadeName: 'Ivory 3C', color: getSwatchColor(3, 'cool') },
  { id: 'sol-wear-20', name: 'Solene Long-Wear Concealer', category: 'face', finish: 'matte', hasShimmer: false, shade: 7, undertone: 'warm', price: 23, shadeName: 'Amber 7W', color: getSwatchColor(7, 'warm') },
  { id: 'ver-smooth-21', name: 'Veranda Smoothing Concealer', category: 'face', finish: 'natural', hasShimmer: false, shade: 4, undertone: 'neutral', price: 19, shadeName: 'Sand 4N', color: getSwatchColor(4, 'neutral') },
  { id: 'ver-undereye-22', name: 'Veranda Under-Eye Concealer', category: 'face', finish: 'satin', hasShimmer: false, shade: 6, undertone: 'warm', price: 20, shadeName: 'Golden 6W', color: getSwatchColor(6, 'warm') },
  { id: 'aur-focus-23', name: 'Auria Soft Focus Concealer', category: 'face', finish: 'natural', hasShimmer: false, shade: 8, undertone: 'neutral', price: 22, shadeName: 'Chestnut 8N', color: getSwatchColor(8, 'neutral') },
  { id: 'aur-cover-24', name: 'Auria Matte Cover Concealer', category: 'face', finish: 'matte', hasShimmer: false, shade: 9, undertone: 'cool', price: 21, shadeName: 'Cocoa 9C', color: getSwatchColor(9, 'cool') },
  { id: 'noo-lumi-25', name: 'Noora Luminous Concealer', category: 'face', finish: 'dewy', hasShimmer: false, shade: 1, undertone: 'cool', price: 20, shadeName: 'Porcelain 1C', color: getSwatchColor(1, 'cool') },
  { id: 'mar-every-26', name: 'Marlow Everyday Concealer', category: 'face', finish: 'natural', hasShimmer: false, shade: 10, undertone: 'warm', price: 19, shadeName: 'Espresso 10W', color: getSwatchColor(10, 'warm') },

  // --- A few Prep / Eyes / Lips items so the Shop filter tabs are never empty ---------------
  { id: 'ver-primer-27', name: 'Veranda Smoothing Prep Primer', category: 'prep', finish: 'natural', hasShimmer: false, shade: 5, undertone: 'neutral', price: 24, shadeName: 'Universal', color: getSwatchColor(5, 'neutral') },
  { id: 'aur-primer-28', name: 'Auria Blur Setting Primer', category: 'prep', finish: 'matte', hasShimmer: false, shade: 5, undertone: 'neutral', price: 26, shadeName: 'Universal', color: getSwatchColor(5, 'neutral') },
  { id: 'lum-lip-29', name: 'Lumira Satin Lip Color', category: 'lips', finish: 'satin', hasShimmer: false, shade: 5, undertone: 'warm', price: 18, shadeName: 'Rosewood', color: getSwatchColor(5, 'warm') },
  { id: 'sol-eye-30', name: 'Solene Shimmer Eye Quad', category: 'eyes', finish: 'glam', hasShimmer: true, shade: 5, undertone: 'warm', price: 28, shadeName: 'Bronze Glow', color: getSwatchColor(5, 'warm') },
];
