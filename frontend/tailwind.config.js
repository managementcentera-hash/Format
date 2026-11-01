/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'lov-progress': {
          '0%': { left: '10%' },
          '100%': { left: '90%' },
        },
        'incoming': {
          '0%': { transform: 'translateX(100%)', 'opacity': 0 },
          '100%': { transform: 'translateX(0%)', 'opacity': 1 },
        }
      },
      animation: {
        'progress-run': 'lov-progress infinite 1.4s cubic-bezier(0.1, 0.6, 0.2, 1) backwards',
        'present': 'incoming 1 0.2s cubic-bezier(0.1, 0.6, 0.2, 1) forwards',
      }
    },
  },
  plugins: [],
}

