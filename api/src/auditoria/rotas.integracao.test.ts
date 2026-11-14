import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { hashSenha } from '../auth/senha.js';
import { base32Decodificar, codigoTotp, passoDe } from '../auth/totp.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import { POR_PAGINA } from './rotas.js';

// L22e: o Admin lê a auditoria da própria instituição, só ações administrativas e logins da equipe. Dados fictícios.
const SENHA = 'senha de teste longa 123';
const AGORA = new Date('2026-11-14T12:00:00Z');
let amb: Ambiente;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
const ids: Record<string, string> = {};

const chamar = (metodo: 'GET' | 'POST', url: string, quem?: string, payload?: unknown) =>
  app.inject({
    method: metodo,
    url,
    payload: payload as object,
    headers: quem ? { cookie: cookies[quem] as string } : {},
  });

async function criar(inst: string, perfil: string, apelido: string) {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@l22e.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
    [id, inst, perfil, `Pessoa ${apelido}`, email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
    [inst, id, await hashSenha(SENHA)],
  );
  ids[apelido] = id;
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { instituicao_id: inst, email, senha: SENHA },
  });
  expect(r.statusCode).toBe(200);
  let cookie = String(r.headers['set-cookie']).split(';')[0] as string;
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
      payload: { codigo: codigoTotp(base32Decodificar(ini.json().segredo), passoDe(AGORA)) },
      headers: { cookie },
    });
    expect(ok.statusCode).toBe(200);
    cookie = String(ok.headers['set-cookie']).split(';')[0] as string;
  }
  cookies[apelido] = cookie;
}

// Grava um evento direto no banco (superusuário); o gatilho calcula seq, data e hash
const evento = (inst: string, ator: string, acao: string, alvo = '', depois: unknown = null) =>
  amb.admin.query(
    'INSERT INTO auditoria_evento (instituicao_id, ator, acao, alvo, depois) VALUES ($1,$2,$3,$4,$5)',
    [inst, ator, acao, alvo, depois === null ? null : JSON.stringify(depois)],
  );

type Item = { seq: number; quando: string; quem: string; perfil: string; frase: string };
const listar = async (quem: string, consulta = '') => {
  const r = await chamar('GET', `/auditoria${consulta}`, quem);
  expect(r.statusCode).toBe(200);
  return r.json() as { integra: boolean | null; tem_mais: boolean; eventos: Item[] };
};

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => AGORA,
    limiteTentativasPorMinuto: 1000,
  });
  for (const [inst, perfil, nome] of [
    [amb.instA, 'admin', 'admin'],
    [amb.instA, 'pedagogico', 'ped'],
    [amb.instA, 'professor', 'prof'],
    [amb.instA, 'responsavel', 'resp'],
    [amb.instA, 'aluno', 'aluno1'],
    [amb.instB, 'admin', 'adminB'],
  ] as const)
    await criar(inst, perfil, nome);
  // O Admin cria uma conta e desativa outra
  const c = await chamar('POST', '/usuarios', 'admin', {
    perfil: 'aluno',
    nome: 'Aluno Criado',
    email: 'criado@l22e.exemplo',
  });
  expect(c.statusCode).toBe(201);
  expect((await chamar('POST', `/usuarios/${ids.aluno1}/desativar`, 'admin', {})).statusCode).toBe(
    204,
  );
  // Eventos da vida do aluno e de ator desconhecido, que nunca podem aparecer
  await evento(amb.instA, `usuario:${ids.aluno1}`, 'tarefa.criada', 'tarefa:1', { titulo: 'X' });
  await evento(amb.instA, `usuario:${ids.aluno1}`, 'nota_pessoal.criada', 'nota:1');
  await evento(amb.instA, `usuario:${ids.aluno1}`, 'dificuldade.alterada', 'disciplina_aluno:1');
  await evento(amb.instA, `usuario:${ids.resp}`, 'auth.login_ok', `usuario:${ids.resp}`);
  await evento(amb.instA, 'anonimo', 'auth.login_falhou', '', { motivo: 'desconhecido' });
  // Ação da equipe que não é administrativa (nota lançada) e conteúdo sensível em `depois`
  await evento(amb.instA, `usuario:${ids.prof}`, 'nota.lancada', 'nota:9', {
    valor: 'SEGREDO-123',
  });
  await evento(amb.instA, `usuario:${ids.admin}`, 'turma.criada', 'turma:1', {
    nome: 'DEPOIS-OCULTO',
  });
  // Evento da outra instituição
  await evento(amb.instB, `usuario:${ids.adminB}`, 'turma.criada', 'turma:2');
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('auditoria do Admin da escola (L22e)', () => {
  it('o Admin vê ações administrativas e entradas da equipe, em frases, com a cadeia íntegra', async () => {
    const r = await listar('admin');
    const frases = r.eventos.map((e) => `${e.quem}: ${e.frase}`);
    expect(r.integra).toBe(true);
    expect(frases).toContain('Pessoa admin: Criou a conta de Aluno Criado');
    expect(frases).toContain('Pessoa admin: Desativou a conta de Pessoa aluno1');
    expect(frases).toContain('Pessoa admin: Criou uma turma');
    expect(frases).toContain('Pessoa admin: Entrou no sistema');
    expect(frases).toContain('Pessoa prof: Entrou no sistema');
    expect(frases).toContain('Pessoa ped: Entrou no sistema');
    expect(r.eventos[0]).toMatchObject({ perfil: 'Administração' });
    // Do mais novo para o mais velho
    const seqs = r.eventos.map((e) => e.seq);
    expect([...seqs].sort((a, b) => b - a)).toEqual(seqs);
  });

  it('nada da vida do aluno aparece: nem eventos de aluno, de responsável, anônimos ou fora da lista', async () => {
    const r = await listar('admin');
    const texto = JSON.stringify(r);
    for (const quem of ['Pessoa aluno1:', 'Pessoa resp:']) {
      expect(r.eventos.map((e) => `${e.quem}:`)).not.toContain(quem);
    }
    expect(r.eventos.some((e) => e.quem === 'Pessoa aluno1' || e.quem === 'Pessoa resp')).toBe(
      false,
    );
    expect(texto).not.toMatch(/tarefa|nota pessoal|dificuldade|Tentou entrar e errou/i);
    expect(r.eventos.some((e) => /nota/i.test(e.frase) && !/regras de notas/i.test(e.frase))).toBe(
      false,
    );
    // `antes` e `depois` nunca saem
    expect(texto).not.toContain('SEGREDO-123');
    expect(texto).not.toContain('DEPOIS-OCULTO');
    expect(Object.keys(r.eventos[0] as object).sort()).toEqual(
      ['frase', 'perfil', 'quando', 'quem', 'seq'].sort(),
    );
  });

  it('o Admin só vê a própria instituição', async () => {
    const a = await listar('admin');
    const b = await listar('adminB');
    expect(a.eventos.some((e) => e.quem === 'Pessoa adminB')).toBe(false);
    expect(b.eventos.some((e) => e.quem === 'Pessoa admin')).toBe(false);
    expect(b.eventos.map((e) => e.frase)).toContain('Criou uma turma');
    expect(b.eventos.every((e) => e.quem === 'Pessoa adminB')).toBe(true);
  });

  it('professor, pedagógico, responsável, aluno e quem não entrou são recusados', async () => {
    for (const quem of ['prof', 'ped', 'resp', 'aluno1']) {
      const r = await chamar('GET', '/auditoria', quem);
      // O aluno foi desativado no teste anterior de montagem: a sessão cai (401) ou é negada (403)
      expect([401, 403]).toContain(r.statusCode);
    }
    expect((await chamar('GET', '/auditoria', 'prof')).statusCode).toBe(403);
    expect((await chamar('GET', '/auditoria', 'ped')).statusCode).toBe(403);
    expect((await chamar('GET', '/auditoria', 'resp')).statusCode).toBe(403);
    expect((await chamar('GET', '/auditoria')).statusCode).toBe(401);
    // A tentativa negada fica registrada, e não aparece na lista do Admin
    const negados = await amb.admin.query(
      "SELECT count(*)::int AS n FROM auditoria_evento WHERE acao = 'auditoria.acesso_negado' AND instituicao_id = $1",
      [amb.instA],
    );
    expect(negados.rows[0].n).toBeGreaterThanOrEqual(3);
    expect((await listar('admin')).eventos.map((e) => e.frase).join('|')).not.toMatch(/negad/i);
  });

  it('abrir a primeira página grava a leitura; as páginas seguintes não', async () => {
    const conta = async () =>
      (
        await amb.admin.query(
          "SELECT count(*)::int AS n FROM auditoria_evento WHERE acao = 'auditoria.leitura' AND instituicao_id = $1",
          [amb.instA],
        )
      ).rows[0].n as number;
    const antes = await conta();
    const r = await listar('admin');
    expect(await conta()).toBe(antes + 1);
    expect(r.eventos[0]?.frase).toBe('Abriu a tela de Auditoria');
    await listar('admin', `?antes=${r.eventos[0]?.seq}`);
    expect(await conta()).toBe(antes + 1);
  });

  it('pagina de 50 em 50 e recusa parâmetro inválido', async () => {
    await amb.admin.query(
      `INSERT INTO auditoria_evento (instituicao_id, ator, acao, alvo)
       SELECT $1, $2, 'turma.criada', 'turma:x' FROM generate_series(1, 55)`,
      [amb.instA, `usuario:${ids.admin}`],
    );
    const p1 = await listar('admin');
    expect(p1.eventos).toHaveLength(POR_PAGINA);
    expect(p1.tem_mais).toBe(true);
    const ultimo = p1.eventos[POR_PAGINA - 1]?.seq as number;
    const p2 = await listar('admin', `?antes=${ultimo}`);
    expect(p2.integra).toBeNull();
    expect(p2.eventos.length).toBeGreaterThan(0);
    expect(p2.eventos.every((e) => e.seq < ultimo)).toBe(true);
    expect((await chamar('GET', '/auditoria?antes=abc', 'admin')).statusCode).toBe(400);
    expect((await chamar('GET', '/auditoria?x=1', 'admin')).statusCode).toBe(400);
  });

  it('cadeia adulterada fora do caminho normal aparece como não íntegra', async () => {
    expect((await listar('adminB')).integra).toBe(true);
    await amb.admin.query('SET session_replication_role = replica');
    await amb.admin.query(
      "UPDATE auditoria_evento SET depois = '{\"x\": 1}' WHERE acao = 'turma.criada' AND instituicao_id = $1",
      [amb.instB],
    );
    await amb.admin.query('SET session_replication_role = DEFAULT');
    expect((await listar('adminB')).integra).toBe(false);
  });
});
