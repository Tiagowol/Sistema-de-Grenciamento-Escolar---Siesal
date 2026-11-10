import { configDefaults, defineConfig } from 'vitest/config';

// Testes unitários (rápidos, sem banco). Os de integração rodam no Docker: ver api/vitest.integracao.config.ts
export default defineConfig({
  test: {
    include: ['**/*.test.{ts,tsx}'],
    // Só o CSS dos sinos é lido nos testes (contraste das cores); os demais ficam vazios
    css: { include: [/estilos\/extra\.css/] },
    exclude: [...configDefaults.exclude, '**/*.integracao.test.ts', '**/gerado/**'],
  },
});
