import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { verificarCadeia } from '../auditoria/auditoria.js';
import { hashSenha } from '../auth/senha.js';
import { base32Decodificar, codigoTotp, passoDe } from '../auth/totp.js';
import { withTenant } from '../banco/withTenant.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// Turmas, disciplinas e vínculos (L14): API do Admin, regras e isolamento entre instituições A e B.
const SENHA = 'senha de teste longa 123';
let amb: Ambiente;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
const ids: Record<string, string> = {};

const chamar = (metodo: 'GET' | 'POST', url: string, quem: string, payload?: unknown) =>
  app.inject({
    method: metodo,
    url,
    payload: payload as object,
    headers: { cookie: cookies[quem] as string },
  });

// Cria pessoa fictícia na instituição e entra (devolve o cookie)
async function criarPessoa(inst: string, perfil: string, apelido: string, logar = true) {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@t.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
    [id, inst, perfil, `Pessoa ${apelido}`, email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
    [inst, id, await hashSenha(SENHA)],
  );
  ids[apelido] = id;
  if (!logar) return;
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { instituicao_id: inst, email, senha: SENHA },
  });
  expect(r.statusCode).toBe(200);
  let cookie = String(r.headers['set-cookie']).split(';')[0] as string;
  // Admin só tem sessão completa com TOTP ativo
  if (perfil === 'admin') {
    const ini = await app.inject({
      method: 'POST',
      url: '/auth/totp/iniciar',
      payload: {},
      headers: { cookie },
    });
    const ok = await app.inject({
      method: 'POST',
      url: '/auth/totp/confirmar',
      payload: { codigo: codigoTotp(base32Decodificar(ini.json().segredo), passoDe(new Date())) },
      headers: { cookie },
    });
    expect(ok.statusCode).toBe(200);
    cookie = String(ok.headers['set-cookie']).split(';')[0] as string;
  }
  cookies[apelido] = cookie;
}

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    limiteTentativasPorMinuto: 1000,
  });
  await criarPessoa(amb.instA, 'admin', 'adminA');
  await criarPessoa(amb.instB, 'admin', 'adminB');
  await criarPessoa(amb.instA, 'professor', 'profA');
  await criarPessoa(amb.instA, 'aluno', 'alunoA');
  await criarPessoa(amb.instA, 'responsavel', 'respA');
  await criarPessoa(amb.instB, 'professor', 'profB');
  await criarPessoa(amb.instB, 'aluno', 'alunoB2');
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('permissão (matriz v3): só o admin administra', () => {
  it.each(['profA', 'alunoA', 'respA'])(
    '%s é negado em todas as rotas, com auditoria',
    async (quem) => {
      for (const url of ['/turmas', '/disciplinas', '/vinculos']) {
        expect((await chamar('GET', url, quem)).statusCode).toBe(403);
      }
      const corpo = { nome: 'X', ano_letivo: 2026, turno: 'manha' };
      expect((await chamar('POST', '/turmas', quem, corpo)).statusCode).toBe(403);
      expect((await chamar('POST', '/disciplinas', quem, { nome: 'X' })).statusCode).toBe(403);
      const v = { tipo: 'aluno_turma', usuario_id: ids.alunoA, turma_id: randomUUID() };
      expect((await chamar('POST', '/vinculos', quem, v)).statusCode).toBe(403);
      const negados = await amb.admin.query(
        "SELECT count(*)::int AS n FROM auditoria_evento WHERE acao = 'turmas.acesso_negado' AND ator = $1",
        [`usuario:${ids[quem]}`],
      );
      expect(negados.rows[0].n).toBeGreaterThan(0);
    },
  );

  it('sem sessão = 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/turmas' })).statusCode).toBe(401);
  });
});

describe('admin da instituição A', () => {
  it('cria turma e disciplina, recusa repetida e dados inválidos', async () => {
    const t = await chamar('POST', '/turmas', 'adminA', {
      nome: '7º A',
      ano_letivo: 2026,
      turno: 'manha',
    });
    expect(t.statusCode).toBe(201);
    ids.turmaA = t.json().id;
    const rep = await chamar('POST', '/turmas', 'adminA', {
      nome: ' 7º a ',
      ano_letivo: 2026,
      turno: 'tarde',
    });
    expect(rep.statusCode).toBe(409);
    expect(
      (await chamar('POST', '/turmas', 'adminA', { nome: '', ano_letivo: 2026, turno: 'manha' }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await chamar('POST', '/turmas', 'adminA', {
          nome: 'Y',
          ano_letivo: 2026,
          turno: 'madrugada',
        })
      ).statusCode,
    ).toBe(400);
    const d = await chamar('POST', '/disciplinas', 'adminA', { nome: 'Matemática' });
    expect(d.statusCode).toBe(201);
    ids.discA = d.json().id;
    expect(
      (await chamar('POST', '/disciplinas', 'adminA', { nome: 'matemática' })).statusCode,
    ).toBe(409);
  });

  it('vincula professor, aluno e responsável', async () => {
    const prof = await chamar('POST', '/vinculos', 'adminA', {
      tipo: 'professor_turma',
      usuario_id: ids.profA,
      turma_id: ids.turmaA,
      disciplina_id: ids.discA,
    });
    expect(prof.statusCode).toBe(201);
    const aluno = await chamar('POST', '/vinculos', 'adminA', {
      tipo: 'aluno_turma',
      usuario_id: ids.alunoA,
      turma_id: ids.turmaA,
    });
    expect(aluno.statusCode).toBe(201);
    ids.vinculoAluno = aluno.json().id;
    const resp = await chamar('POST', '/vinculos', 'adminA', {
      tipo: 'responsavel_aluno',
      usuario_id: ids.respA,
      aluno_id: ids.alunoA,
    });
    expect(resp.statusCode).toBe(201);
    const lista = (await chamar('GET', '/vinculos', 'adminA')).json().vinculos;
    expect(lista).toHaveLength(3);
    const turmas = (await chamar('GET', '/turmas', 'adminA')).json().turmas;
    expect(turmas[0]).toMatchObject({ nome: '7º A', alunos: 1, professores: 1, ativa: true });
  });

  it('recusa vínculo repetido, perfil errado e campos que não pertencem ao tipo', async () => {
    const igual = { tipo: 'aluno_turma', usuario_id: ids.alunoA, turma_id: ids.turmaA };
    expect((await chamar('POST', '/vinculos', 'adminA', igual)).statusCode).toBe(409);
    const errado = { tipo: 'aluno_turma', usuario_id: ids.profA, turma_id: ids.turmaA };
    expect((await chamar('POST', '/vinculos', 'adminA', errado)).statusCode).toBe(400);
    const extra = { ...igual, disciplina_id: ids.discA };
    expect((await chamar('POST', '/vinculos', 'adminA', extra)).statusCode).toBe(400);
    const semAluno = { tipo: 'responsavel_aluno', usuario_id: ids.respA, aluno_id: ids.profA };
    expect((await chamar('POST', '/vinculos', 'adminA', semAluno)).statusCode).toBe(400);
  });

  it('inativa e reativa sem apagar; inativa vínculo; tudo na auditoria íntegra', async () => {
    expect(
      (await chamar('POST', `/vinculos/${ids.vinculoAluno}/inativar`, 'adminA')).statusCode,
    ).toBe(204);
    expect(
      (await chamar('POST', `/vinculos/${ids.vinculoAluno}/inativar`, 'adminA')).statusCode,
    ).toBe(404);
    // vínculo inativo deixa o aluno vincular de novo
    expect(
      (
        await chamar('POST', '/vinculos', 'adminA', {
          tipo: 'aluno_turma',
          usuario_id: ids.alunoA,
          turma_id: ids.turmaA,
        })
      ).statusCode,
    ).toBe(201);
    expect((await chamar('POST', `/turmas/${ids.turmaA}/inativar`, 'adminA')).statusCode).toBe(204);
    const nova = { tipo: 'aluno_turma', usuario_id: ids.alunoA, turma_id: ids.turmaA };
    expect((await chamar('POST', '/vinculos', 'adminA', nova)).statusCode).toBe(400);
    const inativa = (await chamar('GET', '/turmas', 'adminA')).json().turmas[0];
    expect(inativa.ativa).toBe(false);
    expect((await chamar('POST', `/turmas/${ids.turmaA}/reativar`, 'adminA')).statusCode).toBe(204);
    // nada foi apagado de verdade
    const total = await amb.admin.query(
      'SELECT count(*)::int AS n FROM vinculo WHERE instituicao_id = $1',
      [amb.instA],
    );
    expect(total.rows[0].n).toBe(4);
    const problemas = await withTenant(amb.bancoApp, { instituicaoId: amb.instA }, (tx) =>
      verificarCadeia(tx),
    );
    expect(problemas).toEqual([]);
    const acoes = await amb.admin.query(
      "SELECT DISTINCT acao FROM auditoria_evento WHERE instituicao_id = $1 AND acao ~ '^(turma|disciplina|vinculo)\\.'",
      [amb.instA],
    );
    expect(acoes.rows.map((r) => r.acao)).toEqual(
      expect.arrayContaining([
        'turma.criada',
        'turma.inativada',
        'turma.reativada',
        'disciplina.criada',
        'vinculo.criado',
        'vinculo.inativado',
      ]),
    );
  });
});

describe('isolamento entre instituições A e B (banco e API)', () => {
  beforeAll(async () => {
    const t = await chamar('POST', '/turmas', 'adminB', {
      nome: '7º A',
      ano_letivo: 2026,
      turno: 'tarde',
    });
    expect(t.statusCode).toBe(201); // mesmo nome da turma de A: permitido, são instituições diferentes
    ids.turmaB = t.json().id;
    ids.discB = (await chamar('POST', '/disciplinas', 'adminB', { nome: 'Matemática' })).json().id;
    const v = await chamar('POST', '/vinculos', 'adminB', {
      tipo: 'professor_turma',
      usuario_id: ids.profB,
      turma_id: ids.turmaB,
      disciplina_id: ids.discB,
    });
    expect(v.statusCode).toBe(201);
    ids.vinculoB = v.json().id;
  });

  it('cada admin lista só o que é da própria instituição', async () => {
    const a = await chamar('GET', '/turmas', 'adminA');
    const b = await chamar('GET', '/turmas', 'adminB');
    expect(a.json().turmas.map((t: { id: string }) => t.id)).toEqual([ids.turmaA]);
    expect(b.json().turmas.map((t: { id: string }) => t.id)).toEqual([ids.turmaB]);
    expect(
      (await chamar('GET', '/disciplinas', 'adminB'))
        .json()
        .disciplinas.map((d: { id: string }) => d.id),
    ).toEqual([ids.discB]);
    const vb = (await chamar('GET', '/vinculos', 'adminB')).json().vinculos;
    expect(vb.map((v: { id: string }) => v.id)).toEqual([ids.vinculoB]);
    const va = (await chamar('GET', '/vinculos', 'adminA')).json().vinculos;
    expect(va.map((v: { id: string }) => v.id)).not.toContain(ids.vinculoB);
  });

  it('A não inativa turma, disciplina nem vínculo de B (404) e nada muda em B', async () => {
    expect((await chamar('POST', `/turmas/${ids.turmaB}/inativar`, 'adminA')).statusCode).toBe(404);
    expect((await chamar('POST', `/disciplinas/${ids.discB}/inativar`, 'adminA')).statusCode).toBe(
      404,
    );
    expect((await chamar('POST', `/vinculos/${ids.vinculoB}/inativar`, 'adminA')).statusCode).toBe(
      404,
    );
    const ativos = await amb.admin.query(
      'SELECT (SELECT count(*) FROM turma WHERE id = $1 AND desativado_em IS NULL)::int AS t, (SELECT count(*) FROM vinculo WHERE id = $2 AND desativado_em IS NULL)::int AS v',
      [ids.turmaB, ids.vinculoB],
    );
    expect(ativos.rows[0]).toEqual({ t: 1, v: 1 });
  });

  it('A não vincula pessoa, turma ou disciplina de B', async () => {
    const turmaDeB = { tipo: 'aluno_turma', usuario_id: ids.alunoA, turma_id: ids.turmaB };
    expect((await chamar('POST', '/vinculos', 'adminA', turmaDeB)).statusCode).toBe(400);
    const pessoaDeB = { tipo: 'aluno_turma', usuario_id: ids.alunoB2, turma_id: ids.turmaA };
    expect((await chamar('POST', '/vinculos', 'adminA', pessoaDeB)).statusCode).toBe(400);
    const discDeB = {
      tipo: 'professor_turma',
      usuario_id: ids.profA,
      turma_id: ids.turmaA,
      disciplina_id: ids.discB,
    };
    expect((await chamar('POST', '/vinculos', 'adminA', discDeB)).statusCode).toBe(400);
  });

  it('RLS no banco: sem contexto nada aparece; com contexto de A, nada de B', async () => {
    for (const tabela of ['turma', 'disciplina', 'vinculo']) {
      const sem = await amb.bancoApp.$queryRawUnsafe<unknown[]>(`SELECT * FROM ${tabela}`);
      expect(sem, `${tabela} sem contexto`).toEqual([]);
      const deA = await withTenant(amb.bancoApp, { instituicaoId: amb.instA }, (tx) =>
        tx.$queryRawUnsafe<{ instituicao_id: string }[]>(`SELECT instituicao_id FROM ${tabela}`),
      );
      expect(deA.length).toBeGreaterThan(0);
      expect(
        deA.every((l) => l.instituicao_id === amb.instA),
        tabela,
      ).toBe(true);
    }
  });

  it('o banco recusa gravar em B com o contexto de A e recusa DELETE', async () => {
    await expect(
      withTenant(
        amb.bancoApp,
        { instituicaoId: amb.instA },
        (tx) =>
          tx.$executeRaw`INSERT INTO turma (instituicao_id, nome, ano_letivo, turno)
                       VALUES (${amb.instB}::uuid, 'Invasora', 2026, 'manha')`,
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(
        amb.bancoApp,
        { instituicaoId: amb.instA },
        (tx) => tx.$executeRaw`DELETE FROM turma`,
      ),
    ).rejects.toThrow();
  });

  it('vínculo cruzado entre instituições é impedido pela chave estrangeira composta', async () => {
    await expect(
      amb.admin.query(
        `INSERT INTO vinculo (instituicao_id, tipo, usuario_id, turma_id) VALUES ($1, 'aluno_turma', $2, $3)`,
        [amb.instA, ids.alunoA, ids.turmaB],
      ),
    ).rejects.toThrow();
  });

  it('o banco confere o perfil mesmo se a API fosse contornada', async () => {
    await expect(
      amb.admin.query(
        `INSERT INTO vinculo (instituicao_id, tipo, usuario_id, turma_id) VALUES ($1, 'aluno_turma', $2, $3)`,
        [amb.instA, ids.profA, ids.turmaA],
      ),
    ).rejects.toThrow(/perfil aluno/);
  });
});
