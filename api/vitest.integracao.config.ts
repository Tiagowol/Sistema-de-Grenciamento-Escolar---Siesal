import { defineConfig } from 'vitest/config';

// Testes de integração da api: precisam de PostgreSQL (rodam no Docker, serviço "teste")
export default defineConfig({
  test: {
    include: ['src/**/*.integracao.test.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
