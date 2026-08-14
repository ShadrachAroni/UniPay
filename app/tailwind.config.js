/** @type {import('tailwindcss').Config} */
const { tokens } = require('./theme/tokens');

module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './theme/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: tokens.colors.light.brand,
        'brand-dark': tokens.colors.dark.brand,
        unipay: {
          dark: tokens.colors.dark.background,
          card: tokens.colors.dark.surface,
          accent: tokens.colors.dark.brand,
          brand: tokens.colors.light.brand,
          success: tokens.colors.semantic.success,
          warning: tokens.colors.semantic.warning,
          error: tokens.colors.semantic.error,
          border: tokens.colors.dark.border,
        },
      },
    },
  },
  plugins: [],
};
