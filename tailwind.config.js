/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"STKaiti"', '"KaiTi"', '"Songti SC"', '"Noto Serif SC"', 'serif'],
        kai: ['"STKaiti"', '"KaiTi"', 'serif'],
      },
      colors: {
        /* 金漆系 */
        gold: {
          DEFAULT: '#d4af37',
          light: '#f0d978',
          dark: '#8b6914',
          deep: '#4a3810',
        },
        /* 朱砂系（印章、高光） */
        cinnabar: {
          DEFAULT: '#dc2626',
          light: '#ef4444',
          dark: '#991b1b',
          deep: '#7f1d1d',
        },
        /* 青铜系（框线、装饰） */
        bronze: {
          DEFAULT: '#78350f',
          light: '#a16207',
          dark: '#451a03',
        },
        /* 羊皮/古卷 */
        parchment: {
          DEFAULT: '#e8dcc0',
          light: '#fef3c7',
          dark: '#78716c',
        },
        /* 墨色（深底） */
        ink: {
          DEFAULT: '#0f172a',
          black: '#0b0a07',
          deep: '#1a1109',
        },
      },
      boxShadow: {
        glow: '0 0 18px 2px rgba(212,175,55,0.55)',
        'glow-red': '0 0 16px 2px rgba(220,38,38,0.55)',
        card: '0 10px 25px -6px rgba(0,0,0,0.7)',
        'card-deep': '0 12px 32px -8px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,240,200,0.1)',
        bronze: 'inset 0 0 12px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,175,55,0.3)',
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
        sealStamp: {
          '0%': { transform: 'rotate(-3deg) scale(2)', opacity: '0' },
          '50%': { transform: 'rotate(-3deg) scale(1.2)', opacity: '1' },
          '100%': { transform: 'rotate(-3deg) scale(1)', opacity: '1' },
        },
        inkDrop: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        shine: 'shine 1.6s ease-in-out infinite',
        floatY: 'floatY 2.2s ease-in-out infinite',
        'seal-stamp': 'sealStamp 0.5s ease-out forwards',
        'ink-drop': 'inkDrop 0.35s ease-out forwards',
      },
      backgroundImage: {
        'bronze-gradient': 'linear-gradient(180deg, #2a1810 0%, #1a0f08 100%)',
        'parchment-gradient': 'linear-gradient(135deg, #3b2816 0%, #1a1109 100%)',
        'seal-red': 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
      },
    },
  },
  plugins: [],
};
