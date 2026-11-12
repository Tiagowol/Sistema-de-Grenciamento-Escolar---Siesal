import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import { hashCodigo } from './codigos.js';
import type { Email } from './email.js';

// L22a-1c (migração 0027): conta do representante legal, aluno menor criado por ele, limite e tipo do Pedagógico.
// Só dados fictícios.
const SENHA = 'senha de teste longa 123';
const SENHA_ALUNO = 'senha provisoria longa 456';
let amb: Ambiente;
let app: FastifyInstance;
const enviados: Email[] = [];

const chamar = (metodo: 'GET' | 'POST', url: string, payload?: unknown, cookie?: string) =>
  app.inject({ method: metodo, url, payload: payload as object, headers: cookie ? { cookie } : {} });
const cookieDe = (r: { headers: Record<string, unknown> }) =>
  String(r.headers['set-cookie']).split(';')[0] as string;
const tokenDoEmail = (para: string) =>
  [...enviados].reverse().find((x) => x.para === para)?.texto.match(/#([A-Za-z0-9_-]+)/)?.[1] as string;
const sufixo = () => randomUUID().slice(0, 8);

async function representante(papel = 'responsavel') {
  const email = `rep-${sufixo()}@rep.exemplo`;
  const c = await chamar('POST', '/auth/pessoa/cadastro', {
    nome: 'Representante Fictício',
    email,
    senha: SENHA,
    papel,
    aceite: true,
  });
  expect(c.statusCode, c.body).toBe(202);
  await chamar('POST', '/auth/pessoa/confirmar-email', { token: tokenDoEmail(email) });
  const l = await chamar('POST', '/auth/pessoa/login', { email, senha: SENHA });
  expect(l.statusCode, l.body).toBe(200);
  return { email, cookie: cookieDe(l) };
}
const convite = async () => {
  const codigo = `ABCD-${sufixo().toUpperCase().replace(/[^A-Z0-9]/g, 'X')}-EFGH`;
  await amb.admin.query(
    "INSERT INTO convite_individual (codigo_hash, criado_por, tipo) VALUES ($1, 'teste', 'individual')",
    [hashCodigo(codigo)],
  );
  return codigo;
};
const alunoMenor = async (codigo: string, extra: Record<string, unknown> = {}, aluno: Record<string, unknown> = {}) => ({
  codigo,
  aluno: { nome: 'Aluno Menor', email: `al-${sufixo()}@rep.exemplo`, nascimento: '2015-03-10', senha: SENHA_ALUNO, ...aluno },
  representante_nascimento: '1985-06-20',
  aceite: true,
  ...extra,
});

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    limiteTentativasPorMinuto: 1000,
    enviarEmail: async (e) => {
      enviados.push(e);
    },
  });
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('cadastro do representante e tipo do Pedagógico', () => {
  it('"responsavel" é aceito como papel; Pedagógico exige o tipo interno e os outros papéis não aceitam tipo', async () => {
    const base = { nome: 'Fulano Fictício', senha: SENHA, aceite: true };
    const ok = (extra: object) => chamar('POST', '/auth/pessoa/cadastro', { ...base, email: `t-${sufixo()}@rep.exemplo`, ...extra });
    expect((await ok({ papel: 'responsavel' })).statusCode).toBe(202);
    expect((await ok({ papel: 'pedagogico' })).statusCode).toBe(400);
    expect((await ok({ papel: 'pedagogico', tipo_profissional: 'fonoaudiologo' })).statusCode).toBe(202);
    expect((await ok({ papel: 'pedagogico', tipo_profissional: 'astronauta' })).statusCode).toBe(400);
    expect((await ok({ papel: 'professor', tipo_profissional: 'psicologo' })).statusCode).toBe(400);
    expect((await ok({ papel: 'professor' })).statusCode).toBe(202);
    const q = await amb.admin.query("SELECT count(*)::int AS n FROM pessoa WHERE tipo_profissional = 'fonoaudiologo'");
    expect(q.rows[0].n).toBe(1);
  });
});

describe('representante legal cria o aluno menor', () => {
  it('cria espaço, aluno ativo com senha provisória, vínculo "legal" com aceite, e o representante entra no espaço', async () => {
    const rep = await representante();
    const cod = await convite();
    const alunoEmail = `aluno-${sufixo()}@rep.exemplo`;
    const r = await chamar('POST', '/auth/pessoa/aluno-menor', await alunoMenor(cod, {}, { email: alunoEmail }), rep.cookie);
    expect(r.statusCode, r.body).toBe(201);
    const inst = r.json().instituicao_id as string;
    // banco: aluno ativo, senha provisória, nascimento; vínculo legal com termo e data
    const al = await amb.admin.query(
      `SELECT u.situacao, c.senha_provisoria, d.nascimento::text AS nasc FROM usuario u
         JOIN credencial c ON c.instituicao_id = u.instituicao_id AND c.usuario_id = u.id
         JOIN aluno_dados d ON d.instituicao_id = u.instituicao_id AND d.usuario_id = u.id
        WHERE u.instituicao_id = $1 AND u.perfil = 'aluno'`,
      [inst],
    );
    expect(al.rows[0]).toMatchObject({ situacao: 'ativo', senha_provisoria: true, nasc: '2015-03-10' });
    const v = await amb.admin.query(
      'SELECT tipo_responsavel, termo_versao, aceito_em FROM vinculo WHERE instituicao_id = $1 AND tipo = $2',
      [inst, 'responsavel_aluno'],
    );
    expect(v.rows[0].tipo_responsavel).toBe('legal');
    expect(v.rows[0].termo_versao).toBe('pessoa-1');
    expect(v.rows[0].aceito_em).not.toBeNull();
    // o e-mail do representante NÃO entra no índice de espaço individual; o do aluno entra
    const idx = await amb.admin.query('SELECT email_busca FROM espaco_individual WHERE instituicao_id = $1', [inst]);
    expect(idx.rows.map((x) => x.email_busca)).toEqual([alunoEmail]);
    // convite usado
    const cv = await amb.admin.query('SELECT usado_em FROM convite_individual WHERE codigo_hash = $1', [hashCodigo(cod)]);
    expect(cv.rows[0].usado_em).not.toBeNull();
    // representante vê o espaço e entra como "responsavel"
    const eu = await chamar('GET', '/auth/pessoa/eu', undefined, rep.cookie);
    expect(eu.json().espacos).toEqual([
      expect.objectContaining({ instituicao_id: inst, tipo: 'individual', perfil: 'responsavel' }),
    ]);
    expect(eu.json().representante).toEqual({ alunos: 1, limite: 5 });
    const e = await chamar('POST', '/auth/pessoa/entrar', { instituicao_id: inst }, rep.cookie);
    expect(e.statusCode, e.body).toBe(200);
    expect(e.json().usuario.perfil).toBe('responsavel');
    // o aluno entra pelo login "sem instituição" com a senha provisória e precisa trocá-la
    const la = await chamar('POST', '/auth/login', { sem_instituicao: true, email: alunoEmail, senha: SENHA_ALUNO });
    expect(la.statusCode, la.body).toBe(200);
    expect(la.json().nivel).toBe('trocar_senha');
  });

  it('o mesmo representante pode ter vários alunos (cada um com o seu espaço)', async () => {
    const rep = await representante();
    for (let i = 0; i < 2; i++) {
      const r = await chamar('POST', '/auth/pessoa/aluno-menor', await alunoMenor(await convite()), rep.cookie);
      expect(r.statusCode, r.body).toBe(201);
    }
    const eu = await chamar('GET', '/auth/pessoa/eu', undefined, rep.cookie);
    expect(eu.json().espacos).toHaveLength(2);
    expect(eu.json().representante.alunos).toBe(2);
  });

  it('recusa com a mesma resposta: convite usado ou falso, e-mail em uso, e-mail igual ao do representante', async () => {
    const rep = await representante();
    const cod = await convite();
    const alunoEmail = `repetido-${sufixo()}@rep.exemplo`;
    expect((await chamar('POST', '/auth/pessoa/aluno-menor', await alunoMenor(cod, {}, { email: alunoEmail }), rep.cookie)).statusCode).toBe(201);
    const recusas = [
      await chamar('POST', '/auth/pessoa/aluno-menor', await alunoMenor(cod), rep.cookie), // convite usado
      await chamar('POST', '/auth/pessoa/aluno-menor', await alunoMenor('NAO-EXISTE-0000'), rep.cookie), // convite falso
      await chamar('POST', '/auth/pessoa/aluno-menor', await alunoMenor(await convite(), {}, { email: alunoEmail }), rep.cookie), // e-mail em uso
      await chamar('POST', '/auth/pessoa/aluno-menor', await alunoMenor(await convite(), {}, { email: rep.email }), rep.cookie), // e-mail do representante
    ];
    for (const x of recusas) expect(x.statusCode, x.body).toBe(400);
    expect(new Set(recusas.map((x) => x.body)).size).toBe(1);
  });

  it('confere idades, senha, aceite e sessão', async () => {
    const rep = await representante();
    const pedir = async (corpo: unknown) => chamar('POST', '/auth/pessoa/aluno-menor', corpo, rep.cookie);
    expect((await pedir(await alunoMenor(await convite(), {}, { nascimento: '2000-01-15' }))).statusCode).toBe(400); // aluno maior
    expect((await pedir(await alunoMenor(await convite(), { representante_nascimento: '2012-01-01' }))).statusCode).toBe(400); // representante menor
    expect((await pedir(await alunoMenor(await convite(), {}, { senha: 'curta' }))).statusCode).toBe(400);
    expect((await pedir(await alunoMenor(await convite(), { aceite: false }))).statusCode).toBe(400);
    expect((await pedir(await alunoMenor(await convite(), { extra: 1 }))).statusCode).toBe(400);
    expect((await chamar('POST', '/auth/pessoa/aluno-menor', await alunoMenor(await convite()))).statusCode).toBe(401);
    const n = await amb.admin.query("SELECT count(*)::int AS n FROM vinculo WHERE tipo_responsavel = 'legal' AND criado_em > now() - interval '1 minute' AND usuario_id IN (SELECT id FROM usuario WHERE email = $1)", [rep.email]);
    expect(n.rows[0].n).toBe(0); // nada foi criado por essas tentativas
  });

  it('limite de alunos (configurável no Master): no limite, mensagem de suporte; subir o limite libera', async () => {
    await amb.admin.query("UPDATE configuracao_plataforma SET valor = '2' WHERE chave = 'limite_alunos_por_representante'");
    try {
      const rep = await representante();
      for (let i = 0; i < 2; i++)
        expect((await chamar('POST', '/auth/pessoa/aluno-menor', await alunoMenor(await convite()), rep.cookie)).statusCode).toBe(201);
      const cod = await convite();
      const cheio = await chamar('POST', '/auth/pessoa/aluno-menor', await alunoMenor(cod), rep.cookie);
      expect(cheio.statusCode).toBe(409);
      expect(cheio.json().erro).toBe('Você chegou ao limite de alunos. Entre em contato com o suporte.');
      expect((await chamar('GET', '/auth/pessoa/eu', undefined, rep.cookie)).json().representante).toEqual({ alunos: 2, limite: 2 });
      // o convite não foi gasto
      const cv = await amb.admin.query('SELECT usado_em FROM convite_individual WHERE codigo_hash = $1', [hashCodigo(cod)]);
      expect(cv.rows[0].usado_em).toBeNull();
      await amb.admin.query("UPDATE configuracao_plataforma SET valor = '3' WHERE chave = 'limite_alunos_por_representante'");
      expect((await chamar('POST', '/auth/pessoa/aluno-menor', await alunoMenor(cod), rep.cookie)).statusCode).toBe(201);
    } finally {
      await amb.admin.query("UPDATE configuracao_plataforma SET valor = '5' WHERE chave = 'limite_alunos_por_representante'");
    }
  });

  it('a aplicação não lê a configuração da plataforma diretamente', async () => {
    const r = await amb.bancoApp.$queryRawUnsafe('SELECT 1 FROM configuracao_plataforma').then(
      () => 'leu',
      (e: unknown) => String(e),
    );
    expect(r).toMatch(/permission denied/);
  });
});
