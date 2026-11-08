import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { gerarSenhaProvisoria, hashSenha } from '../auth/senha.js';

// Job "aluno-teste": cria 1 aluno FICTÍCIO numa instituição existente, só para teste local.
// Trava: exige ALUNO_TESTE_CONFIRMA=sim. Senha provisória mostrada uma vez.
function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}
if (process.env.ALUNO_TESTE_CONFIRMA !== 'sim') {
  throw new Error(
    'Defina ALUNO_TESTE_CONFIRMA=sim. Este job é só para teste local, com dados fictícios.',
  );
}
const instituicaoId = exigir('INSTITUICAO_ID');
const email = exigir('ALUNO_EMAIL').trim().toLowerCase();
const senha = gerarSenhaProvisoria();
const id = randomUUID();
const cliente = new pg.Client({ connectionString: exigir('DATABASE_URL_ADMIN') });
await cliente.connect();
try {
  await cliente.query('BEGIN');
  await cliente.query(
    "INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1, $2, 'aluno', $3, $4)",
    [id, instituicaoId, exigir('ALUNO_NOME'), email],
  );
  await cliente.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash, senha_provisoria) VALUES ($1, $2, $3, true)',
    [instituicaoId, id, await hashSenha(senha)],
  );
  await cliente.query('COMMIT');
} catch (erro) {
  await cliente.query('ROLLBACK');
  throw erro;
} finally {
  await cliente.end();
}
console.log('aluno-teste: criado (dados fictícios)');
console.log(`  login do aluno: ${email}`);
console.log(`  senha provisória (aparece só agora): ${senha}`);
