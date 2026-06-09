/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f1',
          100: '#ffe1e1',
          200: '#ffc8c8',
          300: '#ffa2a2',
          400: '#fb6b6d',
          500: '#ef3d40',
          600: '#db2f32',
          700: '#b91f24',
          800: '#991f23',
          900: '#7f2023',
        },
      },
      boxShadow: {
        card: '0 1px 1px rgba(15,23,42,.03), 0 10px 28px rgba(15,23,42,.06)',
        elevated: '0 1px 2px rgba(15,23,42,.05), 0 18px 40px rgba(15,23,42,.10)',
      },
    },
  },
  plugins: [],
};
