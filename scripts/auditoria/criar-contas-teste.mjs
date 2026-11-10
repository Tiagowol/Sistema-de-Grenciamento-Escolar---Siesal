// Cria as 4 contas de teste do autor (aluno, professor, responsável, pedagogo) na instituição dada. Nunca imprime senha.

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire('/app/package.json');
const pg = req('pg');
const { gerarSenhaProvisoria, hashSenha } = await import('/app/dist/auth/senha.js');
const [instId, saida] = process.argv.slice(2);
const c = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
const contas = {};
try {
  await c.query('BEGIN');
  const novo = async (perfil, nome, email) => {
    const id = randomUUID();
    const senha = gerarSenhaProvisoria();
    await q(
      'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
      [id, instId, perfil, nome, email],
    );
    await q(
      'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash, senha_provisoria) VALUES ($1,$2,$3,true)',
      [instId, id, await hashSenha(senha)],
    );
    contas[email] = { senha, perfil, id };
    return id;
  };
  const aluno = await novo('aluno', 'Aluno Teste', 'aluno@teste.com');
  const prof = await novo('professor', 'Professor Teste', 'professor@teste.com');
  const resp = await novo('responsavel', 'Responsável Teste', 'responsavel@teste.com');
  await novo('pedagogico', 'Pedagogo Teste', 'pedagogo@teste.com');
  // Liga ao que já existe na turma de auditoria da Demonstração
  const [t] = await q(
    "SELECT t.id AS turma, v.disciplina_id AS disc FROM turma t JOIN vinculo v ON v.turma_id = t.id AND v.tipo='professor_turma' WHERE t.instituicao_id=$1 AND t.nome LIKE 'Turma Auditoria%' ORDER BY t.criado_em LIMIT 1",
    [instId],
  );
  if (t) {
    const vinc = (tipo, usuario, tu, d, al) =>
      q(
        'INSERT INTO vinculo (instituicao_id, tipo, usuario_id, turma_id, disciplina_id, aluno_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [instId, tipo, usuario, tu, d, al],
      );
    await vinc('professor_turma', prof, t.turma, t.disc, null);
    await vinc('aluno_turma', aluno, t.turma, null, null);
    await vinc('responsavel_aluno', resp, null, null, aluno);
  }
  await c.query('COMMIT');
} catch (e) {
  await c.query('ROLLBACK');
  console.error('ERRO:', e.message);
  process.exit(1);
} finally {
  await c.end();
}
fs.writeFileSync(saida, JSON.stringify(contas, null, 2));
console.log(`criadas ${Object.keys(contas).length} contas de teste (senhas só no arquivo)`);
