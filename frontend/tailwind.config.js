/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        dark: '#050505',
        card: '#0a0a0a',
        cardHover: '#121212',
        primary: '#3b82f6',
        accent: '#8b5cf6',
        clay: '#141414',
      },
      boxShadow: {
        'clay': '6px 6px 12px #020202, -6px -6px 12px #080808, inset 1px 1px 2px rgba(255, 255, 255, 0.04), inset -1px -1px 2px rgba(0, 0, 0, 0.5)',
        'clay-sm': '4px 4px 8px #020202, -4px -4px 8px #080808, inset 1px 1px 1px rgba(255, 255, 255, 0.04), inset -1px -1px 1px rgba(0, 0, 0, 0.5)',
        'clay-hover': 'inset 4px 4px 8px rgba(0,0,0,0.6), inset -4px -4px 8px rgba(255,255,255,0.02)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        'glow': '0 0 20px rgba(59, 130, 246, 0.5)',
      },
      animation: {
        'gradient-x': 'gradient-x 15s ease infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.7s ease-out forwards',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': { backgroundSize: '200% 200%', backgroundPosition: 'left center' },
          '50%': { backgroundSize: '200% 200%', backgroundPosition: 'right center' },
        },
        'fadeIn': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slideUp': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
