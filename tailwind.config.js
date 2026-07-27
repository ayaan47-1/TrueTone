/** @type {import('tailwindcss').Config} */
// TrueTone "Mist" design system — Soft-Surrealism liquid glass.
// Palette + type live here so every screen reskins from one source of truth.
//
// Refinement: the palette + fonts are unchanged (they were already right).
// The only token added here is the inclusive `fitzpatrick` I–VI scale, mirrored
// in src/theme/tokens.ts. Gradient/glass/shadow refinements live in tokens.ts
// (StyleSheet land); type-weight refinements live in Typography.tsx.
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Dominant (60%) — mist lavender washing into white.
        mist: {
          50: '#FFFCF8',
          100: '#FBF7F2',
          200: '#F3EDE3',
          300: '#EBE2D3',
          400: '#DED4C4',
        },
        // Secondary (30%) — washed rose warmth.
        rose: {
          100: '#F8EEE7',
          200: '#EEDCCE',
          300: '#DFC1AF',
        },
        // Accent (10%) — deep mauve for calls-to-action.
        mauve: {
          400: '#A79E91',
          500: '#8A8378',
          600: '#6B655B',
          700: '#3F3A33',
        },
        // Ink — aubergine-tinted neutrals for text.
        ink: {
          DEFAULT: '#221F1A',
          soft: '#6B655B',
          muted: '#8A8378',
          faint: '#C5BDAF',
        },
        sage: '#7E9174',
        clay: '#C1875F',
        // Inclusive Fitzpatrick I–VI scale (onboarding tone strip + fairness UI).
        // Mirrored in src/theme/tokens.ts as `fitzpatrick`.
        fitzpatrick: {
          1: '#F5D9C0',
          2: '#EBC19A',
          3: '#D9A579',
          4: '#B97A50',
          5: '#8A5232',
          6: '#5A3520',
        },
      },
      fontFamily: {
        display: ['Fraunces_600SemiBold'],
        'display-md': ['Fraunces_500Medium'],
        'display-light': ['Fraunces_400Regular'],
        'display-italic': ['Fraunces_500Medium_Italic'],
        sans: ['Mulish_400Regular'],
        body: ['Mulish_400Regular'],
        'body-medium': ['Mulish_500Medium'],
        'body-semibold': ['Mulish_600SemiBold'],
        'body-bold': ['Mulish_700Bold'],
      },
      borderRadius: {
        glass: '30px',
        sheet: '36px',
      },
    },
  },
  plugins: [],
};
