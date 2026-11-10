// Semeia contas e dados FICTÍCIOS para a auditoria externa. Fora do projeto. Nunca imprime senha.

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire('/app/package.json');
const pg = req('pg');
const { gerarSenhaProvisoria, hashSenha } = await import('/app/dist/auth/senha.js');
const [rotulo, instId, dominio, provisoria, saida] = process.argv.slice(2);
const c = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
const contas = {};
try {
  await c.query('BEGIN');
  const novo = async (perfil, nome) => {
    const id = randomUUID();
    const email = `${rotulo}.${perfil}${nome.sufixo ?? ''}@${dominio}`;
    const senha = gerarSenhaProvisoria();
    await q(
      'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
      [id, instId, perfil, nome.texto, email],
    );
    await q(
      'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash, senha_provisoria) VALUES ($1,$2,$3,$4)',
      [instId, id, await hashSenha(senha), provisoria === 'sim'],
    );
    contas[email] = { senha, perfil, id };
    return id;
  };
  const prof = await novo('professor', { texto: 'Professora Auditoria' });
  const a1 = await novo('aluno', { texto: 'Aluna Auditoria Um', sufixo: '1' });
  const a2 = await novo('aluno', { texto: 'Aluno Auditoria Dois', sufixo: '2' });
  const resp = await novo('responsavel', { texto: 'Responsável Auditoria' });
  const ped = await novo('pedagogico', { texto: 'Pedagoga Auditoria' });
  const [{ id: turma }] = await q(
    "INSERT INTO turma (instituicao_id, nome, ano_letivo, turno) VALUES ($1,$2,2026,'manha') RETURNING id",
    [instId, rotulo.startsWith('auditoria') ? 'Turma Auditoria 7º A' : `Turma ${rotulo} 7º A`],
  );
  const [{ id: disc }] = await q(
    'INSERT INTO disciplina (instituicao_id, nome) VALUES ($1,$2) RETURNING id',
    [instId, `Matemática (${rotulo})`],
  );
  const vinc = (tipo, usuario, t, d, al) =>
    q(
      'INSERT INTO vinculo (instituicao_id, tipo, usuario_id, turma_id, disciplina_id, aluno_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [instId, tipo, usuario, t, d, al],
    );
  await vinc('professor_turma', prof, turma, disc, null);
  await vinc('aluno_turma', a1, turma, null, null);
  await vinc('aluno_turma', a2, turma, null, null);
  await vinc('responsavel_aluno', resp, null, null, a1);
  const nota = async (aluno, valor) => {
    const [{ id }] = await q(
      "INSERT INTO nota_oficial (instituicao_id, aluno_id, turma_id, disciplina_id, professor_id, descricao, dia) VALUES ($1,$2,$3,$4,$5,'Prova 1',(now() at time zone 'America/Sao_Paulo')::date - 3) RETURNING id",
      [instId, aluno, turma, disc, prof],
    );
    await q(
      'INSERT INTO nota_oficial_versao (instituicao_id, nota_id, numero, valor, autor_id) VALUES ($1,$2,1,$3,$4)',
      [instId, id, valor, prof],
    );
    return id;
  };
  const n1 = await nota(a1, 7.5);
  await nota(a2, 6.0);
  for (const [quem, perfil] of [
    [a1, 'aluno'],
    [resp, 'responsavel'],
  ])
    await q(
      "INSERT INTO pedido_revisao (instituicao_id, nota_id, pedido_por, perfil_pedinte, texto) VALUES ($1,$2,$3,$4,'Gostaria que a nota fosse olhada de novo.')",
      [instId, n1, quem, perfil],
    );
  await q(
    "INSERT INTO aviso_escolar (instituicao_id, autor_id, autor_perfil, escopo, turma_id, texto) VALUES ($1,$2,'pedagogico','turma',$3,'Bem-vindos à turma de auditoria. Este é um aviso de teste, com dados fictícios.')",
    [instId, ped, turma],
  );
  const tarefa = (aluno, titulo, desloc, disciplina) =>
    q(
      "INSERT INTO tarefa (instituicao_id, usuario_id, titulo, disciplina, prazo, prioridade) VALUES ($1,$2,$3,$4,(now() at time zone 'America/Sao_Paulo')::date + $5::int,'media')",
      [instId, aluno, titulo, disciplina, desloc],
    );
  await tarefa(a1, 'Lista de exercícios', 0, 'Matemática');
  await tarefa(a1, 'Resumo de História', 1, 'História');
  await tarefa(a1, 'Maquete de Ciências', 4, 'Ciências');
  await tarefa(a2, 'Leitura do capítulo 2', 1, 'Português');
  await c.query('COMMIT');
} catch (e) {
  await c.query('ROLLBACK');
  console.error('ERRO ao semear:', e.message);
  process.exit(1);
} finally {
  await c.end();
}
fs.writeFileSync(saida, JSON.stringify(contas, null, 2));
console.log(
  `semeado: ${Object.keys(contas).length} contas fictícias em ${rotulo} (senhas só no arquivo)`,
);
