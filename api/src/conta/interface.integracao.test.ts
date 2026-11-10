import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { verificarCadeia } from '../auditoria/auditoria.js';
import { hashSenha } from '../auth/senha.js';
import { base32Decodificar, codigoTotp, passoDe } from '../auth/totp.js';
import { withTenant } from '../banco/withTenant.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// Preferências de interface (L17d, migração 0015): rótulos do topo e VLibras, nos 5 perfis. Só dados fictícios.
const SENHA = 'senha de teste longa 123';
let amb: Ambiente;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
const ids: Record<string, string> = {};
const emails: Record<string, { inst: string; email: string }> = {};

const chamar = (metodo: 'GET' | 'POST', url: string, quem?: string, payload?: unknown) =>
  app.inject({
    method: metodo,
    url,
    payload: payload as object,
    headers: quem ? { cookie: cookies[quem] as string } : {},
  });

const tentarLogin = (quem: string, senha = SENHA) =>
  app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      instituicao_id: emails[quem]?.inst,
      email: emails[quem]?.email,
      senha,
    },
  });

async function criar(inst: string, perfil: string, apelido: string) {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@k.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
    [id, inst, perfil, `Pessoa ${apelido}`, email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
    [inst, id, await hashSenha(SENHA)],
  );
  ids[apelido] = id;
  emails[apelido] = { inst, email };
  const r = await tentarLogin(apelido);
  expect(r.statusCode).toBe(200);
  let cookie = String(r.headers['set-cookie']).split(';')[0] as string;
  // O Admin precisa configurar o segundo fator antes de usar o sistema
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
      payload: {
        codigo: codigoTotp(
          base32Decodificar(ini.json().segredo),
          passoDe(new Date('2026-11-10T12:00:00Z')),
        ),
      },
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
    agora: () => new Date('2026-11-10T12:00:00Z'),
    limiteTentativasPorMinuto: 1000,
  });
  for (const [inst, perfil, nome] of [
    [amb.instA, 'admin', 'admin'],
    [amb.instA, 'pedagogico', 'ped'],
    [amb.instA, 'professor', 'prof'],
    [amb.instA, 'responsavel', 'resp'],
    [amb.instA, 'aluno', 'aluno1'],
    [amb.instA, 'aluno', 'aluno2'],
    [amb.instB, 'aluno', 'alunoB'],
  ] as const)
    await criar(inst, perfil, nome);
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

const PADRAO = { rotulos: 'icones', vlibras: true, vlibras_aviso_aceito: false };

describe('preferências de interface', () => {
  it('sem sessão 401; corpo inválido 400', async () => {
    expect((await chamar('GET', '/conta/interface')).statusCode).toBe(401);
    expect((await chamar('POST', '/conta/interface', undefined, PADRAO)).statusCode).toBe(401);
    for (const ruim of [
      { ...PADRAO, rotulos: 'grande' },
      { ...PADRAO, vlibras: 'sim' },
      { ...PADRAO, extra: 1 },
      { rotulos: 'texto' },
    ])
      expect((await chamar('POST', '/conta/interface', 'aluno1', ruim)).statusCode).toBe(400);
  });

  it('os 5 perfis leem o padrão e gravam a própria escolha, que volta depois de novo login', async () => {
    for (const quem of ['admin', 'ped', 'prof', 'resp', 'aluno1']) {
      expect((await chamar('GET', '/conta/interface', quem)).json().interface).toEqual(PADRAO);
      const r = await chamar('POST', '/conta/interface', quem, {
        rotulos: 'texto',
        vlibras: false,
        vlibras_aviso_aceito: false,
      });
      expect(r.statusCode, quem).toBe(200);
    }
    // Novo login (outro cookie): a escolha continua
    const novo = await tentarLogin('prof');
    const cookie = String(novo.headers['set-cookie']).split(';')[0] as string;
    const r = await app.inject({ method: 'GET', url: '/conta/interface', headers: { cookie } });
    expect(r.json().interface).toEqual({
      rotulos: 'texto',
      vlibras: false,
      vlibras_aviso_aceito: false,
    });
  });

  it('cada pessoa vê só a sua: outro aluno e outra instituição continuam no padrão', async () => {
    expect((await chamar('GET', '/conta/interface', 'aluno2')).json().interface).toEqual(PADRAO);
    expect((await chamar('GET', '/conta/interface', 'alunoB')).json().interface).toEqual(PADRAO);
  });

  it('o aceite do aviso do VLibras fica gravado com a data do primeiro aceite e não se desfaz', async () => {
    const aceitar = { rotulos: 'icones', vlibras: true, vlibras_aviso_aceito: true };
    expect((await chamar('POST', '/conta/interface', 'aluno2', aceitar)).json().interface).toEqual(
      aceitar,
    );
    const antes = await amb.admin.query(
      'SELECT vlibras_aviso_aceito FROM preferencia_interface WHERE usuario_id = $1',
      [ids.aluno2],
    );
    // Desligar o VLibras depois não apaga o aceite
    const r = await chamar('POST', '/conta/interface', 'aluno2', { ...aceitar, vlibras: false });
    expect(r.json().interface).toEqual({ ...aceitar, vlibras: false });
    const depois = await amb.admin.query(
      'SELECT vlibras_aviso_aceito FROM preferencia_interface WHERE usuario_id = $1',
      [ids.aluno2],
    );
    expect(depois.rows[0].vlibras_aviso_aceito).toEqual(antes.rows[0].vlibras_aviso_aceito);
  });

  it('toda gravação é auditada e a cadeia de hash continua íntegra', async () => {
    const n = await amb.admin.query(
      "SELECT count(*)::int AS n FROM auditoria_evento WHERE acao = 'interface.salva'",
    );
    expect(n.rows[0].n).toBeGreaterThanOrEqual(7);
    await withTenant(amb.bancoApp, { instituicaoId: amb.instA }, async (tx) => {
      expect(await verificarCadeia(tx)).toEqual([]);
    });
  });

  it('sem withTenant da instituição, o banco não mostra a linha (RLS)', async () => {
    await withTenant(amb.bancoApp, { instituicaoId: amb.instB }, async (tx) => {
      const linhas = await tx.$queryRaw<unknown[]>`
        SELECT 1 FROM preferencia_interface WHERE usuario_id = ${ids.prof}::uuid`;
      expect(linhas).toHaveLength(0);
    });
  });
});
