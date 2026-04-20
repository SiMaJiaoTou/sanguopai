/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"STKaiti"', '"KaiTi"', '"Songti SC"', 'serif'],
      },
      colors: {
        gold: {
          DEFAULT: '#d4af37',
          light: '#f0d978',
          dark: '#a17f22',
        },
        ink: '#0f172a',
      },
      boxShadow: {
        glow: '0 0 18px 2px rgba(212,175,55,0.55)',
        card: '0 10px 25px -6px rgba(0,0,0,0.7)',
      },
      keyframes: {
        shine: {
          '0%,100%': { boxShadow: '0 0 12px rgba(212,175,55,0.4)' },
          '50%': { boxShadow: '0 0 28px rgba(212,175,55,0.95)' },
        },
        floatY: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        shine: 'shine 1.6s ease-in-out infinite',
        floatY: 'floatY 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
