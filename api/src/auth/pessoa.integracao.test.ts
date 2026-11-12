import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import { withTenant } from '../banco/withTenant.js';

// L22a-1a (migração 0025): pessoa acima dos espaços. Base de dados apenas; o login por pessoa vem no L22a-1b.
// Só dados fictícios.
let amb: Ambiente;

const novoUsuario = async (instituicao: string, perfil: string, nome: string, email: string) => {
  const id = randomUUID();
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
    [id, instituicao, perfil, nome, email],
  );
  return id;
};

beforeAll(async () => {
  amb = await criarAmbiente();
});
afterAll(async () => {
  await amb?.encerrar();
});

describe('pessoa (migração 0025)', () => {
  it('todo usuário novo ganha uma pessoa com o mesmo nome e e-mail, sem e-mail confirmado', async () => {
    const id = await novoUsuario(amb.instA, 'professor', 'Prof Pessoa', 'prof-pessoa@p.exemplo');
    const q = await amb.admin.query(
      `SELECT p.nome, p.email, p.email_confirmado_em FROM usuario u JOIN pessoa p ON p.id = u.pessoa_id
        WHERE u.id = $1`,
      [id],
    );
    expect(q.rows).toHaveLength(1);
    expect(q.rows[0].nome).toBe('Prof Pessoa');
    expect(q.rows[0].email).toBe('prof-pessoa@p.exemplo');
    expect(q.rows[0].email_confirmado_em).toBeNull();
  });

  it('a mesma pessoa pode ser usada em dois espaços (professor em 2 instituições)', async () => {
    const p = await amb.admin.query(
      "INSERT INTO pessoa (nome, email) VALUES ('Prof Dois', 'prof-dois@p.exemplo') RETURNING id",
    );
    const pessoa = p.rows[0].id as string;
    for (const inst of [amb.instA, amb.instB]) {
      await amb.admin.query(
        `INSERT INTO usuario (instituicao_id, perfil, nome, email, pessoa_id)
         VALUES ($1, 'professor', 'Prof Dois', 'prof-dois@p.exemplo', $2)`,
        [inst, pessoa],
      );
    }
    const q = await amb.admin.query('SELECT count(*)::int AS n FROM usuario WHERE pessoa_id = $1', [pessoa]);
    expect(q.rows[0].n).toBe(2);
    // não criou pessoa a mais para esses dois
    const todas = await amb.admin.query("SELECT count(*)::int AS n FROM pessoa WHERE email = 'prof-dois@p.exemplo'");
    expect(todas.rows[0].n).toBe(1);
  });

  it('e-mail confirmado não repete; e-mail sem confirmação pode repetir (não se junta sem prova)', async () => {
    await amb.admin.query(
      "INSERT INTO pessoa (nome, email, email_confirmado_em) VALUES ('A', 'unico@p.exemplo', now())",
    );
    await expect(
      amb.admin.query(
        "INSERT INTO pessoa (nome, email, email_confirmado_em) VALUES ('B', 'UNICO@p.exemplo', now())",
      ),
    ).rejects.toThrow();
    await amb.admin.query("INSERT INTO pessoa (nome, email) VALUES ('C', 'repete@p.exemplo')");
    await amb.admin.query("INSERT INTO pessoa (nome, email) VALUES ('D', 'repete@p.exemplo')");
  });

  it('a aplicação não lê nem escreve pessoa (só as funções do dono)', async () => {
    const lido = await withTenant(amb.bancoApp, { instituicaoId: amb.instA }, async (tx) => {
      try {
        return await tx.$queryRawUnsafe('SELECT id FROM pessoa');
      } catch (e) {
        return String(e);
      }
    });
    expect(String(lido)).toMatch(/permission denied/);
  });

  it('preenchimento dos usuários que já existiam: entra em cada instituição e não junta e-mails iguais (F-054)', async () => {
    // simula o estado de antes da 0025: usuários com dados em 2 instituições e sem pessoa
    const mesmo = 'mesmo-email@p.exemplo';
    const u1 = await novoUsuario(amb.instA, 'professor', 'Mesma Pessoa', mesmo);
    const u2 = await novoUsuario(amb.instB, 'professor', 'Mesma Pessoa', mesmo);
    const u3 = await novoUsuario(amb.instA, 'aluno', 'Aluno Antigo', 'aluno-antigo@p.exemplo');
    await amb.admin.query('UPDATE usuario SET pessoa_id = NULL WHERE id = ANY($1)', [[u1, u2, u3]]);
    const antes = await amb.admin.query('SELECT count(*)::int AS n FROM usuario');
    const pessoasAntes = await amb.admin.query('SELECT count(*)::int AS n FROM pessoa');
    const r = await amb.admin.query('SELECT pessoa_preencher_faltantes() AS n');
    const n = r.rows[0].n as number;
    expect(n).toBeGreaterThanOrEqual(3);
    const sem = await amb.admin.query('SELECT count(*)::int AS n FROM usuario WHERE pessoa_id IS NULL');
    expect(sem.rows[0].n).toBe(0); // ninguém ficou sem pessoa (a RLS não escondeu linhas)
    const dois = await amb.admin.query('SELECT DISTINCT pessoa_id FROM usuario WHERE id = ANY($1)', [[u1, u2]]);
    expect(dois.rows).toHaveLength(2); // mesmo e-mail em 2 instituições = 2 pessoas (sem junção)
    const depois = await amb.admin.query('SELECT count(*)::int AS n FROM usuario');
    expect(depois.rows[0].n).toBe(antes.rows[0].n); // nenhum usuário perdido ou criado
    const pessoasDepois = await amb.admin.query('SELECT count(*)::int AS n FROM pessoa');
    expect(pessoasDepois.rows[0].n - pessoasAntes.rows[0].n).toBe(n);
    // de novo: nada a fazer
    const r2 = await amb.admin.query('SELECT pessoa_preencher_faltantes() AS n');
    expect(r2.rows[0].n).toBe(0);
  });

  it('vínculo de responsável nasce "legal"; "indicado" só vale para responsavel_aluno', async () => {
    const resp = await novoUsuario(amb.instA, 'responsavel', 'Resp', 'resp-l22@p.exemplo');
    const aluno = await novoUsuario(amb.instA, 'aluno', 'Aluno L22', 'aluno-l22@p.exemplo');
    const v = await amb.admin.query(
      `INSERT INTO vinculo (instituicao_id, tipo, usuario_id, aluno_id)
       VALUES ($1, 'responsavel_aluno', $2, $3) RETURNING tipo_responsavel`,
      [amb.instA, resp, aluno],
    );
    expect(v.rows[0].tipo_responsavel).toBe('legal');
    const ind = await amb.admin.query(
      `INSERT INTO vinculo (instituicao_id, tipo, usuario_id, aluno_id, tipo_responsavel)
       VALUES ($1, 'responsavel_aluno', $2, $3, 'indicado') RETURNING tipo_responsavel`,
      [amb.instA, (await novoUsuario(amb.instA, 'responsavel', 'Resp2', 'resp2-l22@p.exemplo')), aluno],
    );
    expect(ind.rows[0].tipo_responsavel).toBe('indicado');
    await expect(
      amb.admin.query(
        "UPDATE vinculo SET tipo_responsavel = 'xis' WHERE instituicao_id = $1 AND usuario_id = $2",
        [amb.instA, resp],
      ),
    ).rejects.toThrow();
  });
});
