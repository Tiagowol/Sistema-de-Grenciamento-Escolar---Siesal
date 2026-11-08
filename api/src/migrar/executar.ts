import { fileURLToPath } from 'node:url';
import { migrar } from './migrar.js';

// Ponto de entrada do job migrate: lê o ambiente e aplica as migrações.
function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}

await migrar({
  urlAdmin: exigir('DATABASE_URL_ADMIN'),
  senhaApp: exigir('SIESAL_APP_PASSWORD'),
  pastaMigracoes: fileURLToPath(new URL('../../migracoes', import.meta.url)),
  confirmaBackup: process.env.CONFIRMA_BACKUP === 'sim',
  registrar: (mensagem) => console.log(mensagem),
});
