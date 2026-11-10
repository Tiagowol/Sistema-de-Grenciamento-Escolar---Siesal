// Cria 1 conta de teste fictícia (perfil, nome e e-mail dados) com senha provisória. Nunca imprime senha.
// Uso: node criar-conta-teste.mjs <instituicao_id> <arquivo_saida> <perfil> <nome> <email>

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire('/app/package.json');
const pg = req('pg');
const { gerarSenhaProvisoria, hashSenha } = await import('/app/dist/auth/senha.js');
const [instId, saida, perfil, nome, email] = process.argv.slice(2);
// Só perfis escolares; master e admin ficam fora deste script
const PERMITIDOS = ['aluno', 'professor', 'responsavel', 'pedagogico'];
if (!instId || !saida || !PERMITIDOS.includes(perfil) || !nome || !email) {
  console.error(
    'uso: <instituicao_id> <saida> <aluno|professor|responsavel|pedagogico> <nome> <email>',
  );
  process.exit(1);
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
await c.connect();
const id = randomUUID();
const senha = gerarSenhaProvisoria();
try {
  await c.query('BEGIN');
  await c.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
    [id, instId, perfil, nome, email],
  );
  await c.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash, senha_provisoria) VALUES ($1,$2,$3,true)',
    [instId, id, await hashSenha(senha)],
  );
  await c.query('COMMIT');
} catch (e) {
  await c.query('ROLLBACK');
  console.error('ERRO:', e.message);
  process.exit(1);
} finally {
  await c.end();
}
fs.writeFileSync(saida, JSON.stringify({ [email]: { senha, perfil, id } }, null, 2));
console.log(`conta ${email} criada com perfil ${perfil} (senha só no arquivo)`);
