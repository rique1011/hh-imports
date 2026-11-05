import type { Config } from 'tailwindcss'

const config = {
  theme: {
    extend: {
      colors: {
        luxury: {
          black: '#0A0A0A', surface: '#111111', raised: '#191816',
          ivory: '#F3EFE7', muted: '#ABA69D', line: '#2C2923',
          gold: { DEFAULT: '#C5A059', light: '#E8D5AD', dark: '#93703B' },
        },
        // Preserva as telas de checkout, conta e admin existentes.
        'hb-black': '#0A0A0A', 'hb-gray': '#111111',
        'hb-gold': '#C5A059', 'hb-goldLight': '#E8D5AD', 'hb-goldDark': '#93703B',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Arial', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      boxShadow: { gold: '0 8px 32px -16px rgb(197 160 89 / 40%)' },
      backgroundImage: { 'gold-metal': 'linear-gradient(115deg, #B38A48 0%, #E8D5AD 48%, #C5A059 100%)' },
      keyframes: {
        'page-enter': { from: { opacity: '0.92' }, to: { opacity: '1' } },
        'gold-sheen': { from: { transform: 'translateX(-150%) skewX(-18deg)' }, to: { transform: 'translateX(250%) skewX(-18deg)' } },
        'cart-pop': { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.12)' } },
      },
      animation: {
        'page-enter': 'page-enter 180ms ease-out',
        'gold-sheen': 'gold-sheen 650ms ease-out',
        'cart-pop': 'cart-pop 260ms ease-out',
      },
    },
  },
} satisfies Config

export default config
