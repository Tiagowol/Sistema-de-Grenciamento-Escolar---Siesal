import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { hashSenha } from '../auth/senha.js';
import { base32Decodificar, codigoTotp, passoDe } from '../auth/totp.js';
import { criarOperadores } from '../migrar/bootstrap.js';
import { emitirConviteMaster } from '../migrar/convite-master.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import { comoOperacao } from './servico.js';

// L20: situações da instituição, módulos, contagens só numéricas e trilha do Master. Dados fictícios.
const SENHA_MASTER = 'senha ficticia do master 123';
const SENHA = 'senha de teste longa 123';
let amb: Ambiente;
let app: FastifyInstance;
let master = '';
const pessoas: Record<string, { email: string; cookie: string }> = {};

const post = (url: string, payload?: unknown, cookie?: string) =>
  app.inject({
    method: 'POST',
    url,
    payload: payload as object,
    headers: cookie ? { cookie } : {},
  });
const get = (url: string, cookie?: string) =>
  app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });
const cookieDe = (r: { headers: Record<string, unknown> }) =>
  String(r.headers['set-cookie']).split(';')[0] as string;
const entrar = (quem: string) =>
  post('/auth/login', {
    instituicao_id: amb.instA,
    email: pessoas[quem]?.email,
    senha: SENHA,
  });
const situacao = (s: string, confirmar_nome?: string) =>
  post(
    `/operacao/instituicoes/${amb.instA}/situacao`,
    { situacao: s, ...(confirmar_nome === undefined ? {} : { confirmar_nome }) },
    master,
  );
const modulo = (m: string, ligado: boolean) =>
  post(`/operacao/instituicoes/${amb.instA}/modulos`, { modulo: m, ligado }, master);

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => new Date(),
    limiteTentativasPorMinuto: 1000,
  });
  // Master: convite, senha e TOTP (o convite usa o relógio do banco: o teste usa o relógio real)
  await criarOperadores(amb.urlAdminDoBanco, ['master_l20', 'master_l20b']);
  const convite = await emitirConviteMaster(amb.urlAdminDoBanco, 'master_l20');
  const r = await post('/operacao/primeiro-acesso', {
    usuario: 'master_l20',
    convite,
    senha_nova: SENHA_MASTER,
  });
  const limitado = cookieDe(r);
  const ini = await post('/operacao/totp/iniciar', {}, limitado);
  const ok = await post(
    '/operacao/totp/confirmar',
    { codigo: codigoTotp(base32Decodificar(ini.json().segredo), passoDe(new Date())) },
    limitado,
  );
  expect(ok.statusCode).toBe(200);
  master = cookieDe(ok);
  // Escola A: um Admin, um professor e um aluno fictícios
  for (const [perfil, quem] of [
    ['admin', 'admin'],
    ['professor', 'prof'],
    ['aluno', 'aluno'],
  ] as const) {
    const id = randomUUID();
    const email = `${quem}-${id.slice(0, 8)}@l20.exemplo`;
    await amb.admin.query(
      'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
      [id, amb.instA, perfil, `Pessoa Secreta ${quem}`, email],
    );
    await amb.admin.query(
      'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
      [amb.instA, id, await hashSenha(SENHA)],
    );
    pessoas[quem] = { email, cookie: '' };
  }
  const aluno = await entrar('aluno');
  expect(aluno.statusCode).toBe(200);
  (pessoas.aluno as { cookie: string }).cookie = cookieDe(aluno);
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('L20 item 2: painel com contagens só numéricas', () => {
  it('sem sessão de Master = 401; a sessão da escola não abre o painel', async () => {
    expect((await get('/operacao/painel')).statusCode).toBe(401);
    expect((await get('/operacao/painel', pessoas.aluno?.cookie)).statusCode).toBe(401);
    expect((await get('/operacao/auditoria', pessoas.aluno?.cookie)).statusCode).toBe(401);
  });

  it('cada instituição traz só id, nome, situação, data, módulos e números por perfil', async () => {
    const r = await get('/operacao/painel', master);
    expect(r.statusCode).toBe(200);
    const a = r.json().instituicoes.find((i: { id: string }) => i.id === amb.instA);
    expect(Object.keys(a).sort()).toEqual(
      ['contagem', 'criado_em', 'id', 'modulos', 'nome', 'situacao'].sort(),
    );
    // A Aluna A do ambiente + 1 aluno, 1 professor e 1 Admin criados aqui
    expect(a.contagem).toEqual({ admin: 1, professor: 1, aluno: 2 });
    expect(a.modulos).toEqual({ mensagens: true, calendario: true, apoio_aluno: true });
    // Nenhum nome ou e-mail de pessoa sai no painel
    expect(r.body).not.toMatch(/Pessoa Secreta|Aluna A|@l20\.exemplo|@a\.exemplo/);
  });

  it('o papel do Master continua sem ler a tabela usuario; só a função de contagem', async () => {
    await expect(
      comoOperacao(amb.bancoApp, (tx) => tx.$queryRaw`SELECT nome FROM usuario LIMIT 1`),
    ).rejects.toThrow(/permission denied|permissão negada/i);
    // O papel da escola não executa a função de contagem
    await expect(
      amb.bancoApp.$queryRaw`SELECT * FROM contagem_por_perfil(ARRAY[${amb.instA}::uuid])`,
    ).rejects.toThrow(/permission denied|permissão negada/i);
  });
});

describe('L20 item 1: situações e módulos', () => {
  it('em implantação: só o Admin entra; a sessão aberta do aluno deixa de valer', async () => {
    expect((await situacao('em_implantacao')).statusCode).toBe(204);
    expect((await entrar('aluno')).statusCode).toBe(401);
    expect((await entrar('prof')).statusCode).toBe(401);
    expect((await entrar('admin')).statusCode).toBe(200);
    expect((await get('/auth/eu', pessoas.aluno?.cookie)).statusCode).toBe(401);
  });

  it('suspensa: ninguém entra, nem o Admin', async () => {
    expect((await situacao('suspensa')).statusCode).toBe(204);
    for (const quem of ['admin', 'prof', 'aluno'])
      expect((await entrar(quem)).statusCode, quem).toBe(401);
  });

  it('encerrar pede o nome exato (409 sem ele); encerrada, ninguém entra; nada se apaga', async () => {
    expect((await situacao('encerrada')).statusCode).toBe(409);
    expect((await situacao('encerrada', 'Escola errada')).statusCode).toBe(409);
    expect((await situacao('encerrada', 'Escola A (fictícia)')).statusCode).toBe(204);
    expect((await entrar('admin')).statusCode).toBe(401);
    const n = await amb.admin.query(
      'SELECT count(*)::int AS n FROM usuario WHERE instituicao_id = $1',
      [amb.instA],
    );
    expect(n.rows[0].n).toBe(4);
  });

  it('situação inválida = 400; instituição que não existe = 404; volta a ativa e o aluno entra', async () => {
    expect((await situacao('fechada')).statusCode).toBe(400);
    expect(
      (await post(`/operacao/instituicoes/${randomUUID()}/situacao`, { situacao: 'ativa' }, master))
        .statusCode,
    ).toBe(404);
    expect((await situacao('ativa')).statusCode).toBe(204);
    const r = await entrar('aluno');
    expect(r.statusCode).toBe(200);
    (pessoas.aluno as { cookie: string }).cookie = cookieDe(r);
  });

  it('módulo desligado: some do /auth/eu e a API nega as rotas dele; a Agenda continua', async () => {
    const aluno = pessoas.aluno?.cookie;
    expect((await get('/caixa', aluno)).statusCode).toBe(200);
    expect((await modulo('mensagens', false)).statusCode).toBe(204);
    expect((await modulo('calendario', false)).statusCode).toBe(204);
    expect((await modulo('apoio_aluno', false)).statusCode).toBe(204);
    expect((await get('/auth/eu', aluno)).json().modulos).toEqual({
      mensagens: false,
      calendario: false,
      apoio_aluno: false,
    });
    expect((await get('/caixa', aluno)).statusCode).toBe(403);
    expect((await get('/escola/calendario?de=2026-01-01&ate=2026-12-31', aluno)).statusCode).toBe(
      403,
    );
    expect((await get('/ajuda/destinos', aluno)).statusCode).toBe(403);
    expect((await get('/eventos?de=2026-11-01&ate=2026-11-30', aluno)).statusCode).toBe(200);
    // Sem sessão continua 401 (o bloqueio do módulo não revela nada a quem não entrou)
    expect((await get('/caixa')).statusCode).toBe(401);
    expect((await modulo('mensagens', true)).statusCode).toBe(204);
    expect((await get('/caixa', aluno)).statusCode).toBe(200);
    expect((await modulo('outro', true)).statusCode).toBe(400);
  });

  it('a outra instituição não é afetada pelos módulos da primeira', async () => {
    const r = await get('/operacao/painel', master);
    const b = r.json().instituicoes.find((i: { id: string }) => i.id === amb.instB);
    expect(b.modulos).toEqual({ mensagens: true, calendario: true, apoio_aluno: true });
  });
});

describe('L20 itens 2 e 3: trilha do Master e saúde pública', () => {
  it('toda mudança está na trilha, e a cadeia de hash está íntegra', async () => {
    const r = (await get('/operacao/auditoria', master)).json();
    expect(r.integra).toBe(true);
    const acoes = r.eventos.map((e: { acao: string }) => e.acao);
    for (const a of [
      'instituicao.em_implantacao',
      'instituicao.suspensa',
      'instituicao.encerrada',
      'instituicao.reativada',
      'modulo.desligado',
      'modulo.ligado',
    ])
      expect(acoes, a).toContain(a);
    expect(JSON.stringify(r)).not.toMatch(/Pessoa Secreta|@l20\.exemplo/);
  });

  it('a saúde pública diz se o banco responde, sem nenhum outro dado', async () => {
    const r = await get('/saude');
    expect(r.json()).toEqual({ status: 'ok', banco: 'ok' });
  });
});
