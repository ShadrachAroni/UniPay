/** @type {import('tailwindcss').Config} */
const { tokens } = require("./theme/tokens");

module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./theme/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: tokens.colors.light.brand, // Note: For true dark mode via class, NativeWind often uses CSS variables. Since tokens.ts is hardcoded TS, we rely on dynamic styles or class variants. Let's just define base colors.
        'brand-dark': tokens.colors.dark.brand,
      }
    },
  },
  plugins: [],
};
