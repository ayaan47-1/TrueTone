// TrueTone "Mist" design tokens.
// Mirror of the Tailwind palette for code that styles outside className land
// (gradients, blur tints, StyleSheet, shadows). Keep in sync with tailwind.config.js.

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
  white: '#FFFFFF',
} as const;

// The mist mesh: a calm vertical wash, lavender up top, a rose breath at the base.
export const mistGradient = {
  colors: [palette.mist200, palette.mist100, '#FBF7FB', palette.rose100] as const,
  locations: [0, 0.42, 0.74, 1] as const,
  start: { x: 0.1, y: 0 },
  end: { x: 0.9, y: 1 },
};

// Frosted-glass surface tints layered over the mesh.
export const glass = {
  fill: 'rgba(255,255,255,0.55)',
  fillStrong: 'rgba(255,255,255,0.72)',
  edge: 'rgba(255,255,255,0.75)',
  edgeSoft: 'rgba(255,255,255,0.45)',
  innerShadow: 'rgba(124,77,139,0.10)',
  backdrop: 'rgba(42,38,64,0.32)', // dim behind popups
} as const;

// Soft mauve elevation used on glass cards and the primary button.
export const softShadow = {
  shadowColor: palette.mauve700,
  shadowOpacity: 0.18,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
  elevation: 8,
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
