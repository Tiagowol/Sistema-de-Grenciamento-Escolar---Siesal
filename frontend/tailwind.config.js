/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        siesal: {
          dark: '#0a1128',
          navy: '#1c2541',
          slate: '#3a506b',
          cyan: '#00b4d8',
          cyanLight: '#48cae4',
          accent: '#5bc0be',
          card: '#0f1c3f',
          cardHover: '#162756',
          border: '#1f3b73',
          glow: 'rgba(0, 180, 216, 0.15)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
