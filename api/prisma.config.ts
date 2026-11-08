import { defineConfig } from 'prisma/config';

// Só o caminho do esquema: o Prisma gera o cliente; as migrações são SQL próprias (ADR-003)
export default defineConfig({ schema: 'prisma/schema.prisma' });
