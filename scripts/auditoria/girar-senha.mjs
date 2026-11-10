// Gera nova senha provisória para UMA conta de auditoria e grava só no arquivo JSON. Nunca imprime a senha.

import fs from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire('/app/package.json');
const pg = req('pg');
const { gerarSenhaProvisoria, hashSenha } = await import('/app/dist/auth/senha.js');
const [email, arquivo] = process.argv.slice(2);
const contas = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
if (!contas[email]) throw new Error('conta não encontrada no arquivo');
const senha = gerarSenhaProvisoria();
const c = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
await c.connect();
const r = await c.query(
  `UPDATE credencial SET senha_hash = $1, senha_provisoria = true
    WHERE usuario_id = (SELECT id FROM usuario WHERE email = $2 AND situacao = 'ativo')`,
  [await hashSenha(senha), email],
);
await c.end();
if (r.rowCount !== 1) throw new Error('nenhuma credencial atualizada');
contas[email].senha = senha;
fs.writeFileSync(arquivo, JSON.stringify(contas, null, 2));
console.log('senha girada para 1 conta (valor só no arquivo)');
