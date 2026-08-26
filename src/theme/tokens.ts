// TrueTone "Quiet Glass" design tokens (presentation-only).
// Mirror of the Tailwind palette for code that styles outside className land
// (gradients, blur tints, StyleSheet, shadows). Keep in sync with tailwind.config.js.
//
// Refinement summary (see CHANGES.md):
//  • +fitzpatrick scale  — inclusive I–VI tone swatches (also added to tailwind)
//  • +sage/clay (+ ink + tint) — the existing semantic tokens, now usable in StyleSheet land
//  • +glass.highlight    — brighter top edge for the frosted surfaces
//  • mistGradient        — a touch more white "air" in the mid-wash
//  • softShadow          — softer + wider mauve elevation

export const palette = {
  background: '#faf7f2',
  mist50: '#fffdf9',
  mist100: '#faf7f2',
  mist200: '#e7f1ea',
  mist300: '#EBE2D3',
  mist400: '#DED4C4',
  rose100: '#F8EEE7',
  rose200: '#EEDCCE',
  rose300: '#DFC1AF',
  mauve400: '#A79E91',
  mauve500: '#8A8378',
  mauve600: '#6B655B',
  mauve700: '#3F3A33',
  ink: '#221F1A',
  inkSoft: '#6B655B',
  inkMuted: '#8A8378',
  inkFaint: '#a89f8f',
  // Brand palette (brief): green anchor + terracotta accent (used sparingly).
  sage: '#2f7d52',
  sageInk: '#245f3f',
  clay: '#c26a4a',
  clayInk: '#9a4e34',
  green: '#2f7d52',
  greenDark: '#245f3f',
  terracotta: '#c26a4a',
  tint: '#e7f1ea',
  charcoal: '#1f2a26',
  offwhite: '#faf7f2',
  dark: '#221F1A',
  camera: '#111111',
  danger: '#B23B3B',
  white: '#FFFFFF',
} as const;

// Inclusive Fitzpatrick I–VI scale — used by the onboarding tone strip and any
// fairness/coverage UI. Mirrored in tailwind.config.js as `fitzpatrick.1…6`.
// WARM by design: real skin tones are data, not brand — do NOT green-shift.
export const fitzpatrick = ['#F5D9C0', '#EBC19A', '#D9A579', '#B97A50', '#8A5232', '#5A3520'] as const;

// Warm shade-swatch gradient for the foundation/shade hero card (B2 ShadeResult).
// Also WARM by design: real foundation tones are data, not brand.
export const shadeGradient = ['#F7E7D2', '#E9C39A', '#D9A878'] as const;

// The brand mesh: a calm vertical wash — a soft green breath up top settling into
// warm off-white, with a whisper of the green tint returning at the base.
export const mistGradient = {
  colors: [palette.tint, palette.offwhite, palette.mist50, palette.tint] as const,
  locations: [0, 0.48, 0.82, 1] as const,
  start: { x: 0.1, y: 0 },
  end: { x: 0.9, y: 1 },
};

// Frosted-glass surface tints layered over the mesh.
export const glass = {
  fill: 'rgba(255,255,255,0.65)',
  fillStrong: 'rgba(255,255,255,0.82)',
  edge: 'rgba(255,255,255,0.80)',
  edgeSoft: 'rgba(255,255,255,0.55)',
  highlight: 'rgba(255,255,255,0.88)',
  innerShadow: 'rgba(34,31,26,0.05)',
  backdrop: 'rgba(34,31,26,0.30)',
} as const;

// Soft tints for the cosmetic band labels on the results screen (Result.tsx).
// fg = readable text colour, bg = the pill behind it.
export const bandTint = {
  sage: { fg: palette.sageInk, bg: 'rgba(47,125,82,0.14)' },
  mauve: { fg: palette.inkSoft, bg: 'rgba(138,131,120,0.12)' },
  clay: { fg: palette.clayInk, bg: 'rgba(194,106,74,0.14)' },
} as const;
export type BandTone = keyof typeof bandTint;

// Soft mauve elevation used on glass cards and the primary button.
// Refined: a wider, gentler shadow so cards feel like they hover, not sit.
export const softShadow = {
  shadowColor: palette.ink,
  shadowOpacity: 0.06,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

// The exact font-family strings registered in app/_layout.tsx.
export const fonts = {
  display: 'PlusJakartaSans_700Bold',
  displayMedium: 'PlusJakartaSans_600SemiBold',
  displayLight: 'PlusJakartaSans_500Medium',
  displayItalic: 'PlusJakartaSans_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;
