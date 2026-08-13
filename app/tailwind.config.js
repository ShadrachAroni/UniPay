/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        unipay: {
          dark: '#0F172A',
          card: '#1E293B',
          accent: '#3B82F6',
          brand: '#2563EB',
          success: '#10B981',
          warning: '#F59E0B',
          border: '#334155',
        },
      },
    },
  },
  plugins: [],
};
