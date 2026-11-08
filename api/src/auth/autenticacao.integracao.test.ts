import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { verificarCadeia } from '../auditoria/auditoria.js';
import { withTenant } from '../banco/withTenant.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import { MENSAGEM_FALHA } from './autenticacao.js';
import { hashSenha } from './senha.js';
import { NOME_COOKIE } from './sessao.js';
import { base32Decodificar, codigoTotp, passoDe } from './totp.js';

// Autenticação própria (Lote 5): login, sessão, TOTP, códigos de recuperação, bloqueio e limite por IP
const SENHA = 'senha de teste longa 123';
const SEGREDO_APP = 'segredo-de-teste-com-mais-de-32-caracteres!';
let amb: Ambiente;
let relogio = new Date('2026-11-10T12:00:00Z');
let app: FastifyInstance;
let admin: { id: string; email: string };
let professora: { id: string; email: string };

async function criarUsuario(perfil: string, apelido: string) {
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

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: SEGREDO_APP,
    agora: () => relogio,
    limiteTentativasPorMinuto: 1000,
  });
  admin = await criarUsuario('admin', 'admin');
  professora = await criarUsuario('professor', 'professora');
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

const entrar = (u: { email: string }, extra: Record<string, unknown> = {}, senha = SENHA) =>
  app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { instituicao_id: amb.instA, email: u.email, senha, ...extra },
  });

// Pega "nome=valor" do Set-Cookie para reenviar como Cookie
const cookieDe = (resposta: { headers: Record<string, unknown> }): string => {
  const bruto = String(resposta.headers['set-cookie']);
  return bruto.split(';')[0] as string;
};
const comCookie = (cookie: string) => ({ cookie });

describe('login e sessão', () => {
  it('entra com senha certa, cookie seguro e sessão válida em /auth/eu', async () => {
    const r = await entrar(professora);
    expect(r.statusCode).toBe(200);
    expect(r.json().nivel).toBe('completo');
    const bruto = String(r.headers['set-cookie']);
    for (const parte of [NOME_COOKIE, 'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/'])
      expect(bruto).toContain(parte);
    expect(r.headers['cache-control']).toBe('no-store');
    const eu = await app.inject({
      method: 'GET',
      url: '/auth/eu',
      headers: comCookie(cookieDe(r)),
    });
    expect(eu.statusCode).toBe(200);
    expect(eu.json().usuario.id).toBe(professora.id);
  });

  it('senha errada e usuário inexistente recebem a mesma resposta genérica', async () => {
    const errada = await entrar(professora, {}, 'senha errada qualquer 1');
    const inexistente = await entrar({ email: 'ninguem@a.exemplo' });
    expect(errada.statusCode).toBe(401);
    expect(inexistente.statusCode).toBe(401);
    expect(errada.json()).toEqual({ erro: MENSAGEM_FALHA });
    expect(inexistente.json()).toEqual(errada.json());
  });

  it('só guarda o hash do token e a auditoria não traz senha, e-mail nem token', async () => {
    const r = await entrar(professora);
    const token = cookieDe(r).split('=')[1] as string;
    const segredo = token.split('.')[1] as string;
    const sessoes = await amb.admin.query('SELECT token_hash FROM sessao');
    expect(JSON.stringify(sessoes.rows)).not.toContain(segredo);
    const auditoria = await amb.admin.query(
      'SELECT ator, acao, alvo, antes, depois FROM auditoria_evento',
    );
    const texto = JSON.stringify(auditoria.rows);
    expect(texto).toContain('auth.login_ok');
    expect(texto).not.toContain(SENHA);
    expect(texto).not.toContain(segredo);
    expect(texto).not.toContain(professora.email);
  });

  it('logout revoga a sessão e o mesmo token deixa de valer', async () => {
    const cookie = cookieDe(await entrar(professora));
    expect(
      (await app.inject({ method: 'POST', url: '/auth/logout', headers: comCookie(cookie) }))
        .statusCode,
    ).toBe(204);
    expect(
      (await app.inject({ method: 'GET', url: '/auth/eu', headers: comCookie(cookie) })).statusCode,
    ).toBe(401);
  });

  it('a sessão vence em 8 horas', async () => {
    const cookie = cookieDe(await entrar(professora));
    const inicio = relogio;
    relogio = new Date(inicio.getTime() + 8 * 3600_000 + 1000);
    expect(
      (await app.inject({ method: 'GET', url: '/auth/eu', headers: comCookie(cookie) })).statusCode,
    ).toBe(401);
    relogio = inicio;
  });

  it('token com a instituição trocada, malformado ou ausente é recusado', async () => {
    const token = cookieDe(await entrar(professora)).split('=')[1] as string;
    const trocado = `${amb.instB}.${token.split('.')[1]}`;
    for (const cookie of [`${NOME_COOKIE}=${trocado}`, `${NOME_COOKIE}=lixo`, '']) {
      expect(
        (await app.inject({ method: 'GET', url: '/auth/eu', headers: comCookie(cookie) }))
          .statusCode,
      ).toBe(401);
    }
    expect((await app.inject({ method: 'GET', url: '/auth/eu' })).statusCode).toBe(401);
  });

  it('usuário inativo não entra e sessão dele deixa de valer', async () => {
    const u = await criarUsuario('aluno', 'inativo');
    const cookie = cookieDe(await entrar(u));
    await amb.admin.query("UPDATE usuario SET situacao = 'inativo' WHERE id = $1", [u.id]);
    expect(
      (await app.inject({ method: 'GET', url: '/auth/eu', headers: comCookie(cookie) })).statusCode,
    ).toBe(401);
    expect((await entrar(u)).statusCode).toBe(401);
  });

  it('rejeita corpo com campo extra (400) e tipo de conteúdo que não é JSON (415)', async () => {
    const extra = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { instituicao_id: amb.instA, email: 'a@a.exemplo', senha: 'x', admin: true },
    });
    expect(extra.statusCode).toBe(400);
    const texto = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'text/plain' },
      payload: 'a=b',
    });
    expect(texto.statusCode).toBe(415);
  });
});

describe('bloqueio por tentativas', () => {
  it('bloqueia na 5ª falha seguida, recusa a senha certa e libera depois de 15 minutos', async () => {
    const u = await criarUsuario('aluno', 'bloqueio');
    for (let i = 0; i < 5; i++)
      expect((await entrar(u, {}, 'senha errada qualquer 1')).statusCode).toBe(401);
    expect((await entrar(u)).statusCode).toBe(401);
    const inicio = relogio;
    relogio = new Date(inicio.getTime() + 15 * 60_000 + 1000);
    expect((await entrar(u)).statusCode).toBe(200);
    relogio = inicio;
    const acoes = await amb.admin.query('SELECT acao FROM auditoria_evento WHERE ator = $1', [
      `usuario:${u.id}`,
    ]);
    const lista = acoes.rows.map((l: { acao: string }) => l.acao);
    expect(lista).toContain('auth.conta_bloqueada');
    expect(lista).toContain('auth.login_bloqueado');
  });

  it('um acerto zera a contagem de falhas', async () => {
    const u = await criarUsuario('aluno', 'zera');
    for (let i = 0; i < 4; i++) await entrar(u, {}, 'senha errada qualquer 1');
    expect((await entrar(u)).statusCode).toBe(200);
    for (let i = 0; i < 4; i++) await entrar(u, {}, 'senha errada qualquer 1');
    expect((await entrar(u)).statusCode).toBe(200);
  });
});

describe('limite por IP', () => {
  it('responde 429 depois do limite, sem processar a tentativa', async () => {
    const limitado = criarApp({
      banco: amb.bancoApp,
      authSecret: SEGREDO_APP,
      agora: () => relogio,
      limiteTentativasPorMinuto: 3,
    });
    const tentar = () =>
      limitado.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { instituicao_id: amb.instA, email: professora.email, senha: SENHA },
      });
    expect([
      (await tentar()).statusCode,
      (await tentar()).statusCode,
      (await tentar()).statusCode,
    ]).toEqual([200, 200, 200]);
    const quarta = await tentar();
    expect(quarta.statusCode).toBe(429);
    expect(quarta.headers['retry-after']).toBe('60');
    await limitado.close();
  });
});

describe('TOTP e códigos de recuperação', () => {
  it('administrador sem TOTP recebe sessão limitada e ativa o TOTP', async () => {
    const r = await entrar(admin);
    expect(r.json().nivel).toBe('configurar_totp');
    const cookie = cookieDe(r);
    const antes = await app.inject({
      method: 'POST',
      url: '/auth/totp/confirmar',
      headers: comCookie(cookie),
      payload: { codigo: '123456' },
    });
    expect(antes.statusCode).toBe(409); // ainda não iniciou

    const inicio = await app.inject({
      method: 'POST',
      url: '/auth/totp/iniciar',
      headers: comCookie(cookie),
    });
    expect(inicio.statusCode).toBe(200);
    const { segredo, uri } = inicio.json();
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    const bruto = base32Decodificar(segredo);
    const gravado = await amb.admin.query(
      'SELECT totp_segredo_cifrado FROM credencial WHERE usuario_id = $1',
      [admin.id],
    );
    expect(gravado.rows[0].totp_segredo_cifrado).not.toContain(segredo);

    const ruim = await app.inject({
      method: 'POST',
      url: '/auth/totp/confirmar',
      headers: comCookie(cookie),
      payload: { codigo: '000000' },
    });
    expect(ruim.statusCode).toBe(401);

    const ok = await app.inject({
      method: 'POST',
      url: '/auth/totp/confirmar',
      headers: comCookie(cookie),
      payload: { codigo: codigoTotp(bruto, passoDe(relogio)) },
    });
    expect(ok.statusCode).toBe(200);
    const codigos: string[] = ok.json().codigos_recuperacao;
    expect(codigos).toHaveLength(10);

    // A sessão limitada foi trocada por uma completa
    expect(
      (await app.inject({ method: 'GET', url: '/auth/eu', headers: comCookie(cookie) })).statusCode,
    ).toBe(401);
    const novoCookie = cookieDe(ok);
    expect(
      (await app.inject({ method: 'GET', url: '/auth/eu', headers: comCookie(novoCookie) })).json()
        .nivel,
    ).toBe('completo');
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/totp/iniciar',
          headers: comCookie(novoCookie),
        })
      ).statusCode,
    ).toBe(409);

    // Agora o login exige o segundo fator
    const semCodigo = await entrar(admin);
    expect(semCodigo.statusCode).toBe(401);
    expect(semCodigo.json().erro).toBe('segundo_fator_necessario');
    expect((await entrar(admin, { codigo: '000000' })).statusCode).toBe(401);

    // O código do passo já usado na confirmação não vale de novo; o do passo seguinte vale
    const inicioRelogio = relogio;
    expect((await entrar(admin, { codigo: codigoTotp(bruto, passoDe(relogio)) })).statusCode).toBe(
      401,
    );
    relogio = new Date(inicioRelogio.getTime() + 30_000);
    const entrou = await entrar(admin, { codigo: codigoTotp(bruto, passoDe(relogio)) });
    expect(entrou.statusCode).toBe(200);
    expect(entrou.json().nivel).toBe('completo');
    // Replay do mesmo código no mesmo passo
    expect((await entrar(admin, { codigo: codigoTotp(bruto, passoDe(relogio)) })).statusCode).toBe(
      401,
    );

    // Código de recuperação vale uma vez só (aceita minúsculas e sem hífen)
    const rec = codigos[0] as string;
    expect((await entrar(admin, { codigo: rec.toLowerCase().replace('-', '') })).statusCode).toBe(
      200,
    );
    expect((await entrar(admin, { codigo: rec })).statusCode).toBe(401);
    relogio = inicioRelogio;

    const guardado = await amb.admin.query(
      'SELECT codigo_hash FROM codigo_recuperacao WHERE usuario_id = $1',
      [admin.id],
    );
    expect(JSON.stringify(guardado.rows)).not.toContain(rec.replace('-', ''));
  });

  it('professor também pode ativar o TOTP (opcional) e a sessão limitada não existe para ele', async () => {
    const u = await criarUsuario('professor', 'opcional');
    const r = await entrar(u);
    expect(r.json().nivel).toBe('completo');
    const ini = await app.inject({
      method: 'POST',
      url: '/auth/totp/iniciar',
      headers: comCookie(cookieDe(r)),
    });
    expect(ini.statusCode).toBe(200);
  });
});

describe('integridade', () => {
  it('a cadeia de auditoria continua íntegra depois de tudo isso', async () => {
    const problemas = await withTenant(amb.bancoApp, { instituicaoId: amb.instA }, (tx) =>
      verificarCadeia(tx),
    );
    expect(problemas).toEqual([]);
  });

  it('o papel da aplicação não consegue apagar sessões nem credenciais', async () => {
    await expect(
      withTenant(
        amb.bancoApp,
        { instituicaoId: amb.instA },
        (tx) => tx.$executeRaw`DELETE FROM sessao`,
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(
        amb.bancoApp,
        { instituicaoId: amb.instA },
        (tx) => tx.$executeRaw`DELETE FROM credencial`,
      ),
    ).rejects.toThrow();
  });

  it('a instituição B não enxerga credenciais nem sessões da A', async () => {
    const lidas = await withTenant(amb.bancoApp, { instituicaoId: amb.instB }, async (tx) => ({
      credenciais: await tx.credencial.count(),
      sessoes: await tx.sessao.count(),
    }));
    expect(lidas).toEqual({ credenciais: 0, sessoes: 0 });
  });
});
