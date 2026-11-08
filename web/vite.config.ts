import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Em desenvolvimento, /api vai para a API local (porta 3000). Em produção, o nginx faz o mesmo.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        rewrite: (caminho) => caminho.replace(/^\/api/, ''),
      },
    },
  },
});
