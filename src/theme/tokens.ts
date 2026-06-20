// TrueTone "Mist" design tokens — REFINED (presentation-only).
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
  mist50: '#F8F7FF',
  mist100: '#EFEDFB',
  mist200: '#E6E6FA',
  mist300: '#D8D5F2',
  mist400: '#C4BFEA',
  rose100: '#FDE2E4',
  rose200: '#F8D2D7',
  rose300: '#F2BEC6',
  mauve400: '#9A6BAC',
  mauve500: '#7C4D8B',
  mauve600: '#653A73',
  mauve700: '#4E2C59',
  ink: '#2A2640',
  inkSoft: '#5B5570',
  inkMuted: '#8C87A0',
  inkFaint: '#B7B3C6',
  // Gentle semantic pair (was tailwind-only; mirrored here so Result.tsx can tint bands).
  sage: '#7FA88C',     // "looks settled"
  sageInk: '#4E6B57',  // readable sage text on a tint
  clay: '#C9836B',     // "worth a look"
  clayInk: '#A35F44',  // readable clay text on a tint
  white: '#FFFFFF',
} as const;

// Inclusive Fitzpatrick I–VI scale — used by the onboarding tone strip and any
// fairness/coverage UI. Mirrored in tailwind.config.js as `fitzpatrick.1…6`.
export const fitzpatrick = ['#F5D9C0', '#EBC19A', '#D9A579', '#B97A50', '#8A5232', '#5A3520'] as const;

// The mist mesh: a calm vertical wash, lavender up top, a rose breath at the base.
// Refined: the white "air" band is widened (0.46 → 0.80) so glass surfaces sit on
// more light and the rose stays a whisper at the very bottom.
export const mistGradient = {
  colors: [palette.mist200, palette.mist100, '#FBF7FB', palette.rose100] as const,
  locations: [0, 0.46, 0.8, 1] as const,
  start: { x: 0.1, y: 0 },
  end: { x: 0.9, y: 1 },
};

// Frosted-glass surface tints layered over the mesh.
export const glass = {
  fill: 'rgba(255,255,255,0.55)',
  fillStrong: 'rgba(255,255,255,0.72)',
  edge: 'rgba(255,255,255,0.75)',
  edgeSoft: 'rgba(255,255,255,0.45)',
  highlight: 'rgba(255,255,255,0.65)', // brighter top hairline on glass surfaces
  innerShadow: 'rgba(124,77,139,0.10)',
  backdrop: 'rgba(42,38,64,0.32)', // dim behind popups
} as const;

// Soft tints for the cosmetic band labels on the results screen (Result.tsx).
// fg = readable text colour, bg = the pill behind it.
export const bandTint = {
  sage: { fg: palette.sageInk, bg: 'rgba(127,168,140,0.16)' },
  mauve: { fg: palette.mauve600, bg: 'rgba(124,77,139,0.12)' },
  clay: { fg: palette.clayInk, bg: 'rgba(201,131,107,0.16)' },
} as const;
export type BandTone = keyof typeof bandTint;

// Soft mauve elevation used on glass cards and the primary button.
// Refined: a wider, gentler shadow so cards feel like they hover, not sit.
export const softShadow = {
  shadowColor: palette.mauve700,
  shadowOpacity: 0.16,
  shadowRadius: 28,
  shadowOffset: { width: 0, height: 14 },
  elevation: 10,
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
