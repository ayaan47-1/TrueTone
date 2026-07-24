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
  background: '#FBF7F2',
  mist50: '#FFFCF8',
  mist100: '#FBF7F2',
  mist200: '#F3EDE3',
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
  inkFaint: '#C5BDAF',
  sage: '#7E9174',
  sageInk: '#53634C',
  clay: '#C1875F',
  clayInk: '#8B5B3C',
  dark: '#221F1A',
  camera: '#111111',
  danger: '#B23B3B',
  white: '#FFFFFF',
} as const;

// Inclusive Fitzpatrick I–VI scale — used by the onboarding tone strip and any
// fairness/coverage UI. Mirrored in tailwind.config.js as `fitzpatrick.1…6`.
export const fitzpatrick = ['#F5D9C0', '#EBC19A', '#D9A579', '#B97A50', '#8A5232', '#5A3520'] as const;

// The mist mesh: a calm vertical wash, lavender up top, a rose breath at the base.
// Refined: the white "air" band is widened (0.46 → 0.80) so glass surfaces sit on
// more light and the rose stays a whisper at the very bottom.
export const mistGradient = {
  colors: [palette.background, palette.mist50, palette.background, palette.rose100] as const,
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
  sage: { fg: palette.sageInk, bg: 'rgba(126,145,116,0.16)' },
  mauve: { fg: palette.inkSoft, bg: 'rgba(138,131,120,0.12)' },
  clay: { fg: palette.clayInk, bg: 'rgba(193,135,95,0.16)' },
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
  display: 'Fraunces_600SemiBold',
  displayMedium: 'Fraunces_500Medium',
  displayLight: 'Fraunces_400Regular',
  displayItalic: 'Fraunces_500Medium_Italic',
  body: 'Mulish_400Regular',
  bodyMedium: 'Mulish_500Medium',
  bodySemibold: 'Mulish_600SemiBold',
  bodyBold: 'Mulish_700Bold',
} as const;
