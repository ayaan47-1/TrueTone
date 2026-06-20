/** @type {import('tailwindcss').Config} */
// TrueTone "Mist" design system — Soft-Surrealism liquid glass.
// Palette + type live here so every screen reskins from one source of truth.
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Dominant (60%) — mist lavender washing into white.
        mist: {
          50: '#F8F7FF',
          100: '#EFEDFB',
          200: '#E6E6FA', // mist lavender
          300: '#D8D5F2',
          400: '#C4BFEA',
        },
        // Secondary (30%) — washed rose warmth.
        rose: {
          100: '#FDE2E4', // washed rose
          200: '#F8D2D7',
          300: '#F2BEC6',
        },
        // Accent (10%) — deep mauve for calls-to-action.
        mauve: {
          400: '#9A6BAC',
          500: '#7C4D8B',
          600: '#653A73',
          700: '#4E2C59',
        },
        // Ink — aubergine-tinted neutrals for text.
        ink: {
          DEFAULT: '#2A2640',
          soft: '#5B5570',
          muted: '#8C87A0',
          faint: '#B7B3C6',
        },
        sage: '#7FA88C', // gentle "looks settled" positive
        clay: '#C9836B', // gentle "worth a look" caution
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
