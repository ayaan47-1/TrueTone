/** @type {import('tailwindcss').Config} */
// TrueTone design system: terracotta on warm off-white.
// Palette + type live here so every screen reskins from one source of truth.
//
// Section 0 re-theme: token KEYS are unchanged so ~134 screens reskin with zero
// screen edits — only VALUES move from the old bronze "Mist" palette (Fraunces/
// Mulish) to the brief palette: dark terracotta #9a4e34 anchor + pale rose #F8EEE7 wash
// + Plus Jakarta Sans (display) / Inter (body). The fitzpatrick + shade-swatch
// gradients stay WARM (real skin/foundation tones = data, not brand).
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Dominant surface: warm off-white washing to white with a pale rose rise.
        mist: {
          50: '#fffdf9',
          100: '#faf7f2',
          200: '#F8EEE7',
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
        // Ink — warm neutrals for text.
        ink: {
          DEFAULT: '#221F1A',
          soft: '#6B655B',
          muted: '#8A8378',
          faint: '#a89f8f',
        },
        // Former green class names remain as compatibility aliases; all render terracotta.
        brand: {
          green: '#9a4e34',
          greenDark: '#9a4e34',
          terracotta: '#c26a4a',
          terracottaDark: '#9a4e34',
          tint: '#F8EEE7',
          charcoal: '#1f2a26',
          offwhite: '#faf7f2',
        },
        sage: '#9a4e34',
        clay: '#c26a4a',
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
        display: ['PlusJakartaSans_700Bold'],
        'display-md': ['PlusJakartaSans_600SemiBold'],
        'display-light': ['PlusJakartaSans_500Medium'],
        // display-italic retained as a key (maps to 600SemiBold — no italic cut shipped).
        'display-italic': ['PlusJakartaSans_600SemiBold'],
        sans: ['Inter_400Regular'],
        body: ['Inter_400Regular'],
        'body-medium': ['Inter_500Medium'],
        'body-semibold': ['Inter_600SemiBold'],
        'body-bold': ['Inter_700Bold'],
      },
      borderRadius: {
        glass: '30px',
        sheet: '36px',
        card: '20px',
        hero: '28px',
        input: '12px',
        row: '22px',
        band: '26px',
      },
    },
  },
  plugins: [],
};
