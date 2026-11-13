import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import { hashSenha } from './senha.js';
import { base32Decodificar, codigoTotp, passoDe } from './totp.js';

// Cadastro de usuário, senha provisória e troca de senha (Lote 6, item 1)
const SENHA = 'senha de teste longa 123';
const NOVA = 'outra senha bem longa 456';
let amb: Ambiente;
let app: FastifyInstance;
const relogio = new Date('2026-11-10T12:00:00Z');
let cookieAdmin: string;

const cookieDe = (r: { headers: Record<string, unknown> }) =>
  String(r.headers['set-cookie']).split(';')[0] as string;
const post = (url: string, payload: unknown, cookie?: string) =>
  app.inject({
    method: 'POST',
    url,
    payload: payload as object,
    headers: cookie ? { cookie } : {},
  });
const entrar = (email: string, senha: string, extra: object = {}) =>
  post('/auth/login', { instituicao_id: amb.instA, email, senha, ...extra });

async function semear(perfil: string, apelido: string) {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@a.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1, $2, $3, $4, $5)',
    [id, amb.instA, perfil, `Usuário ${apelido}`, email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1, $2, $3)',
    [amb.instA, id, await hashSenha(SENHA)],
  );
  return { id, email };
}

// Admin com TOTP ativo e sessão completa
async function adminCompleto(): Promise<string> {
  const admin = await semear('admin', 'admin');
  const login = await entrar(admin.email, SENHA);
  const limitado = cookieDe(login);
  const ini = await post('/auth/totp/iniciar', {}, limitado);
  const segredo = base32Decodificar(ini.json().segredo);
  const ok = await post(
    '/auth/totp/confirmar',
    { codigo: codigoTotp(segredo, passoDe(relogio)) },
    limitado,
  );
  return cookieDe(ok);
}

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => relogio,
    limiteTentativasPorMinuto: 1000,
  });
  cookieAdmin = await adminCompleto();
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('cadastro de usuário', () => {
  it('admin cria usuário com senha provisória que só aparece na resposta', async () => {
    const r = await post(
      '/usuarios',
      { perfil: 'aluno', nome: 'Aluna Nova', email: 'Nova@A.exemplo' },
      cookieAdmin,
    );
    expect(r.statusCode).toBe(201);
    const { usuario, senha_provisoria: provisoria } = r.json();
    expect(usuario).toMatchObject({ perfil: 'aluno', email: 'nova@a.exemplo' });
    expect(provisoria).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
    const banco = await amb.admin.query(
      'SELECT senha_hash, senha_provisoria FROM credencial WHERE usuario_id = $1',
      [usuario.id],
    );
    expect(banco.rows[0].senha_provisoria).toBe(true);
    expect(banco.rows[0].senha_hash).not.toContain(provisoria);
    const auditoria = JSON.stringify(
      (await amb.admin.query('SELECT * FROM auditoria_evento')).rows,
    );
    expect(auditoria).toContain('usuario.criado');
    expect(auditoria).not.toContain(provisoria);
  });

  it('recusa e-mail repetido (409), perfil inválido e campo extra (400)', async () => {
    const dados = { perfil: 'professor', nome: 'Prof Repetido', email: 'repetido@a.exemplo' };
    expect((await post('/usuarios', dados, cookieAdmin)).statusCode).toBe(201);
    expect(
      (await post('/usuarios', { ...dados, email: 'REPETIDO@a.exemplo' }, cookieAdmin)).statusCode,
    ).toBe(409);
    expect((await post('/usuarios', { ...dados, perfil: 'master' }, cookieAdmin)).statusCode).toBe(
      400,
    );
    expect(
      (await post('/usuarios', { ...dados, email: 'x@a.exemplo', situacao: 'ativo' }, cookieAdmin))
        .statusCode,
    ).toBe(400);
  });

  it('quem não é admin recebe 403, sem sessão 401, e a tentativa é auditada', async () => {
    const prof = await semear('professor', 'professora');
    const cookie = cookieDe(await entrar(prof.email, SENHA));
    const dados = { perfil: 'aluno', nome: 'Intruso', email: 'intruso@a.exemplo' };
    expect((await post('/usuarios', dados, cookie)).statusCode).toBe(403);
    expect((await post('/usuarios', dados)).statusCode).toBe(401);
    const negadas = await amb.admin.query(
      "SELECT count(*)::int AS n FROM auditoria_evento WHERE acao = 'usuario.criacao_negada'",
    );
    expect(negadas.rows[0].n).toBe(1);
    const existe = await amb.admin.query("SELECT 1 FROM usuario WHERE email = 'intruso@a.exemplo'");
    expect(existe.rowCount).toBe(0);
  });

  it('admin ainda sem TOTP (sessão limitada) não cria usuário', async () => {
    const admin2 = await semear('admin', 'admin2');
    const cookie = cookieDe(await entrar(admin2.email, SENHA));
    const r = await post(
      '/usuarios',
      { perfil: 'aluno', nome: 'X', email: 'x1@a.exemplo' },
      cookie,
    );
    expect(r.statusCode).toBe(403);
    expect(r.json().nivel).toBe('configurar_totp');
  });
});

describe('senha provisória e troca de senha', () => {
  async function novoAluno(email: string) {
    const r = await post('/usuarios', { perfil: 'aluno', nome: 'Aluno Troca', email }, cookieAdmin);
    return {
      id: r.json().usuario.id as string,
      email,
      provisoria: r.json().senha_provisoria as string,
    };
  }

  it('o primeiro login só permite trocar a senha', async () => {
    const aluno = await novoAluno('troca1@a.exemplo');
    const login = await entrar(aluno.email, aluno.provisoria);
    expect(login.statusCode).toBe(200);
    expect(login.json().nivel).toBe('trocar_senha');
    const cookie = cookieDe(login);
    expect(
      (await app.inject({ method: 'GET', url: '/auth/eu', headers: { cookie } })).statusCode,
    ).toBe(200);
    expect((await post('/auth/totp/iniciar', {}, cookie)).statusCode).toBe(403);
    expect(
      (await post('/usuarios', { perfil: 'aluno', nome: 'Y', email: 'y@a.exemplo' }, cookie))
        .statusCode,
    ).toBe(403);

    expect(
      (
        await post(
          '/auth/senha/trocar',
          { senha_atual: 'errada errada 12', senha_nova: NOVA },
          cookie,
        )
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await post(
          '/auth/senha/trocar',
          { senha_atual: aluno.provisoria, senha_nova: 'curta' },
          cookie,
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await post(
          '/auth/senha/trocar',
          { senha_atual: aluno.provisoria, senha_nova: aluno.provisoria },
          cookie,
        )
      ).statusCode,
    ).toBe(400);

    const troca = await post(
      '/auth/senha/trocar',
      { senha_atual: aluno.provisoria, senha_nova: NOVA },
      cookie,
    );
    expect(troca.statusCode).toBe(200);
    expect(troca.json().nivel).toBe('completo');
    // Sessão antiga morre; a nova funciona; a senha provisória deixa de valer
    expect(
      (await app.inject({ method: 'GET', url: '/auth/eu', headers: { cookie } })).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({ method: 'GET', url: '/auth/eu', headers: { cookie: cookieDe(troca) } })
      ).json().nivel,
    ).toBe('completo');
    expect((await entrar(aluno.email, aluno.provisoria)).statusCode).toBe(401);
    expect((await entrar(aluno.email, NOVA)).json().nivel).toBe('completo');
  });

  it('admin redefine a senha: a antiga morre e o usuário volta a trocar a senha', async () => {
    const aluno = await novoAluno('troca2@a.exemplo');
    const cookie = cookieDe(await entrar(aluno.email, aluno.provisoria));
    const r = await post(`/usuarios/${aluno.id}/senha-provisoria`, {}, cookieAdmin);
    expect(r.statusCode).toBe(200);
    const nova = r.json().senha_provisoria as string;
    expect(
      (await app.inject({ method: 'GET', url: '/auth/eu', headers: { cookie } })).statusCode,
    ).toBe(401);
    expect((await entrar(aluno.email, aluno.provisoria)).statusCode).toBe(401);
    expect((await entrar(aluno.email, nova)).json().nivel).toBe('trocar_senha');
  });

  it('só admin redefine, e só na própria instituição', async () => {
    const aluno = await novoAluno('troca3@a.exemplo');
    const cookieAluno = cookieDe(
      await entrar(aluno.email, NOVA).then(async (r) =>
        r.statusCode === 200 ? r : entrar(aluno.email, aluno.provisoria),
      ),
    );
    expect((await post(`/usuarios/${aluno.id}/senha-provisoria`, {}, cookieAluno)).statusCode).toBe(
      403,
    );
    expect(
      (await post(`/usuarios/${amb.alunoB}/senha-provisoria`, {}, cookieAdmin)).statusCode,
    ).toBe(404);
    expect((await post('/usuarios/nao-e-uuid/senha-provisoria', {}, cookieAdmin)).statusCode).toBe(
      400,
    );
  });
});

describe('listagem e configuração pública', () => {
  it('admin lista só os usuários da própria instituição, sem dados secretos', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/usuarios',
      headers: { cookie: cookieAdmin },
    });
    expect(r.statusCode).toBe(200);
    const usuarios = r.json().usuarios as { id: string; email: string }[];
    expect(usuarios.length).toBeGreaterThan(1);
    expect(usuarios.some((u) => u.id === amb.alunoB)).toBe(false);
    const texto = JSON.stringify(r.json());
    for (const proibido of ['senha_hash', 'segredo', 'argon2'])
      expect(texto).not.toContain(proibido);
  });

  it('quem não é admin recebe 403 e sem sessão 401', async () => {
    const prof = await semear('professor', 'lista');
    const cookie = cookieDe(await entrar(prof.email, SENHA));
    expect(
      (await app.inject({ method: 'GET', url: '/usuarios', headers: { cookie } })).statusCode,
    ).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/usuarios' })).statusCode).toBe(401);
  });

  it('/config mostra a instituição padrão e o modo local, e nada além disso', async () => {
    const outro = criarApp({
      banco: amb.bancoApp,
      authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
      instituicaoPadrao: amb.instA,
      cookieLocal: true,
    });
    const r = await outro.inject({ method: 'GET', url: '/config' });
    // L22b: sem SIESAL_AMBIENTE o ambiente é "teste"; só o texto exato "producao" vale produção
    expect(r.json()).toEqual({
      instituicao_padrao: amb.instA,
      modo_local: true,
      ambiente: 'teste',
    });
    await outro.close();
    for (const [valor, esperado] of [
      ['producao', 'producao'],
      ['PRODUCAO', 'teste'],
      ['qualquer', 'teste'],
    ] as const) {
      const c = criarApp({
        banco: amb.bancoApp,
        authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
        ambiente: valor,
      });
      expect((await c.inject({ method: 'GET', url: '/config' })).json().ambiente).toBe(esperado);
      await c.close();
    }
  });
});
