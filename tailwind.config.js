/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        valle: {
          // Azul del logo de Gladys Pérez (#1F4FA3)
          50: '#eef3fb',
          100: '#d6e2f5',
          500: '#2f63c0',
          600: '#2558b2',
          700: '#1f4fa3',
          800: '#1a428a',
          900: '#14336b',
        },
      },
    },
  },
  plugins: [],
};
