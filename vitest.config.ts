import { configDefaults, defineConfig } from 'vitest/config';

// Testes unitários (rápidos, sem banco). Os de integração rodam no Docker: ver api/vitest.integracao.config.ts
export default defineConfig({
  test: {
    include: ['**/*.test.{ts,tsx}'],
    exclude: [...configDefaults.exclude, '**/*.integracao.test.ts', '**/gerado/**'],
  },
});
