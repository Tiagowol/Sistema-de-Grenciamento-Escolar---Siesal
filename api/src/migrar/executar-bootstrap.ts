import { criarOperadores } from './bootstrap.js';

// Ponto de entrada do comando de instalação dos Masters (job "bootstrap" do compose)
function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}

await criarOperadores(exigir('DATABASE_URL_ADMIN'), [
  exigir('MASTER_1_USUARIO'),
  exigir('MASTER_2_USUARIO'),
]);
console.log('bootstrap: 2 vagas de Master criadas (pendentes, sem senha)');
