/** @type {import('tailwindcss').Config} */

// As paletas cyan/sky são alimentadas por VARIÁVEIS CSS, permitindo que o
// SIESAL troque a cor de destaque em tempo de execução (Configurações →
// Aparência). Os valores padrão ficam em frontend/src/index.css (:root) e são
// sobrescritos pelo utils/appearance.ts conforme o tema escolhido.
const withAlpha = (prefix) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(
      (shade) => [shade, `rgb(var(--${prefix}${shade}) / <alpha-value>)`]
    )
  );

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
        },
        // Paletas temáticas (alvo das personalizações de cor do usuário)
        cyan: withAlpha('c'),
        sky: withAlpha('s'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
