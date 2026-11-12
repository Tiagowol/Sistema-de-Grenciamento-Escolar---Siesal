import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import type { Email } from './email.js';

// L22a-1b (migração 0026): cadastro próprio, login da pessoa e escolha de espaço. Só dados fictícios.
const SENHA = 'senha de teste longa 123';
let amb: Ambiente;
let app: FastifyInstance;
const enviados: Email[] = [];

const chamar = (metodo: 'GET' | 'POST', url: string, payload?: unknown, cookie?: string) =>
  app.inject({
    method: metodo,
    url,
    payload: payload as object,
    headers: cookie ? { cookie } : {},
  });
const cookieDe = (r: { headers: Record<string, unknown> }) =>
  String(r.headers['set-cookie']).split(';')[0] as string;
const tokenDoEmail = (para: string) => {
  const e = [...enviados].reverse().find((x) => x.para === para);
  return e?.texto.match(/#([A-Za-z0-9_-]+)/)?.[1] as string;
};

async function cadastrarEConfirmar(nome: string, email: string, papel = 'professor') {
  const c = await chamar('POST', '/auth/pessoa/cadastro', { nome, email, senha: SENHA, papel, aceite: true });
  expect(c.statusCode, c.body).toBe(202);
  const t = await chamar('POST', '/auth/pessoa/confirmar-email', { token: tokenDoEmail(email) });
  expect(t.statusCode, t.body).toBe(200);
}
const entrar = (email: string, senha = SENHA) => chamar('POST', '/auth/pessoa/login', { email, senha });

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    limiteTentativasPorMinuto: 1000,
    enviarEmail: async (e) => {
      enviados.push(e);
    },
    linkBase: 'http://teste.local',
  });
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('cadastro próprio e login da pessoa', () => {
  it('cadastro, e-mail de confirmação, login só depois de confirmar, e "sem espaço" na lista', async () => {
    const email = 'prof-sozinho@p.exemplo';
    const c = await chamar('POST', '/auth/pessoa/cadastro', {
      nome: 'Prof Sozinho',
      email,
      senha: SENHA,
      papel: 'professor',
      aceite: true,
    });
    expect(c.statusCode, c.body).toBe(202);
    expect(enviados.at(-1)?.para).toBe(email);
    expect(enviados.at(-1)?.texto).toContain('http://teste.local/confirmar/email#');
    // antes de confirmar o e-mail, não entra
    expect((await entrar(email)).statusCode).toBe(401);
    const ok = await chamar('POST', '/auth/pessoa/confirmar-email', { token: tokenDoEmail(email) });
    expect(ok.statusCode, ok.body).toBe(200);
    // o link vale uma vez
    expect((await chamar('POST', '/auth/pessoa/confirmar-email', { token: tokenDoEmail(email) })).statusCode).toBe(400);
    const l = await entrar(email);
    expect(l.statusCode, l.body).toBe(200);
    const eu = await chamar('GET', '/auth/pessoa/eu', undefined, cookieDe(l));
    expect(eu.statusCode).toBe(200);
    expect(eu.json().pessoa.nome).toBe('Prof Sozinho');
    expect(eu.json().espacos).toEqual([]); // ainda sem convite: nenhum espaço
    // nada escolar sem espaço: o cookie da pessoa não vale como sessão de espaço
    expect((await chamar('GET', '/auth/eu', undefined, cookieDe(l))).statusCode).toBe(401);
    expect((await chamar('GET', '/tarefas', undefined, cookieDe(l))).statusCode).toBe(401);
  });

  it('resposta igual para e-mail novo e e-mail que já tem conta (não revela quem tem conta) e sem e-mail extra', async () => {
    await cadastrarEConfirmar('Prof Repetido', 'prof-repetido@p.exemplo');
    const antes = enviados.length;
    const c = await chamar('POST', '/auth/pessoa/cadastro', {
      nome: 'Outra Pessoa',
      email: 'PROF-REPETIDO@p.exemplo',
      senha: SENHA,
      papel: 'pedagogico',
      aceite: true,
    });
    expect(c.statusCode).toBe(202);
    const nova = await chamar('POST', '/auth/pessoa/cadastro', {
      nome: 'Pessoa Nova',
      email: 'nova-resposta@p.exemplo',
      senha: SENHA,
      papel: 'pedagogico',
      aceite: true,
    });
    expect(nova.statusCode).toBe(202);
    expect(c.body).toBe(nova.body);
    expect(enviados.length).toBe(antes + 1); // só o e-mail novo recebeu link
    // a senha da conta original não mudou
    expect((await entrar('prof-repetido@p.exemplo')).statusCode).toBe(200);
  });

  it('recusa senha curta, papel fora de professor/pedagógico, aceite faltando e campo extra', async () => {
    const base = { nome: 'Fulano', email: 'f@p.exemplo', senha: SENHA, papel: 'professor', aceite: true };
    for (const ruim of [
      { ...base, senha: 'curta' },
      { ...base, papel: 'admin' },
      { ...base, papel: 'aluno' },
      { ...base, aceite: false },
      { ...base, extra: 1 },
      { ...base, email: 'sem-arroba' },
      { ...base, nome: 'Veja https://x.com' },
    ])
      expect((await chamar('POST', '/auth/pessoa/cadastro', ruim)).statusCode, JSON.stringify(ruim)).toBe(400);
  });

  it('link vencido não confirma', async () => {
    const email = 'vencido@p.exemplo';
    await chamar('POST', '/auth/pessoa/cadastro', { nome: 'Vencido', email, senha: SENHA, papel: 'professor', aceite: true });
    await amb.admin.query("UPDATE pedido_email_pessoa SET expira_em = now() - interval '1 minute'");
    expect((await chamar('POST', '/auth/pessoa/confirmar-email', { token: tokenDoEmail(email) })).statusCode).toBe(400);
    expect((await entrar(email)).statusCode).toBe(401);
  });

  it('5 senhas erradas bloqueiam a conta; a senha certa também é recusada durante o bloqueio', async () => {
    const email = 'bloqueio@p.exemplo';
    await cadastrarEConfirmar('Bloqueio', email);
    for (let i = 0; i < 5; i++) expect((await entrar(email, 'senha errada qualquer')).statusCode).toBe(401);
    expect((await entrar(email)).statusCode).toBe(401);
    await amb.admin.query("UPDATE credencial_pessoa SET bloqueado_ate = now() - interval '1 second'");
    expect((await entrar(email)).statusCode).toBe(200);
  });

  it('pessoa criada de usuário antigo (sem senha de pessoa) não entra por este caminho', async () => {
    await amb.admin.query(
      "INSERT INTO usuario (instituicao_id, perfil, nome, email) VALUES ($1,'professor','Antigo','antigo@p.exemplo')",
      [amb.instA],
    );
    expect((await entrar('antigo@p.exemplo')).statusCode).toBe(401);
  });
});

describe('escolha de espaço', () => {
  it('lista só os espaços ativos de professor e pedagógico, e entra sem pedir a senha de novo', async () => {
    const email = 'dois-espacos@p.exemplo';
    await cadastrarEConfirmar('Dois Espaços', email);
    const pessoa = (await amb.admin.query('SELECT id FROM pessoa WHERE lower(email) = $1 AND email_confirmado_em IS NOT NULL', [email])).rows[0].id as string;
    const ligar = (inst: string, perfil: string) =>
      amb.admin.query(
        'INSERT INTO usuario (id, instituicao_id, perfil, nome, email, pessoa_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [randomUUID(), inst, perfil, 'Dois Espaços', email, pessoa],
      );
    await ligar(amb.instA, 'professor');
    await ligar(amb.instB, 'admin'); // admin não entra por aqui
    const l = await entrar(email);
    const ck = cookieDe(l);
    const eu = await chamar('GET', '/auth/pessoa/eu', undefined, ck);
    expect(eu.json().espacos).toHaveLength(1);
    expect(eu.json().espacos[0]).toMatchObject({ instituicao_id: amb.instA, perfil: 'professor' });
    // entra no espaço da instituição A
    const e = await chamar('POST', '/auth/pessoa/entrar', { instituicao_id: amb.instA }, ck);
    expect(e.statusCode, e.body).toBe(200);
    expect(e.json().usuario.perfil).toBe('professor');
    const sessaoEspaco = cookieDe(e);
    const euEspaco = await chamar('GET', '/auth/eu', undefined, sessaoEspaco);
    expect(euEspaco.statusCode).toBe(200);
    expect(euEspaco.json().usuario.perfil).toBe('professor');
    // onde ela não participa, ou como admin, não entra
    expect((await chamar('POST', '/auth/pessoa/entrar', { instituicao_id: amb.instB }, ck)).statusCode).toBe(403);
    expect((await chamar('POST', '/auth/pessoa/entrar', { instituicao_id: randomUUID() }, ck)).statusCode).toBe(403);
    // sem login da pessoa, não entra
    expect((await chamar('POST', '/auth/pessoa/entrar', { instituicao_id: amb.instA })).statusCode).toBe(401);
  });

  it('espaço suspenso não recebe ninguém; e depois do logout a sessão da pessoa não vale', async () => {
    const email = 'suspenso@p.exemplo';
    await cadastrarEConfirmar('Suspenso', email, 'pedagogico');
    const pessoa = (await amb.admin.query('SELECT id FROM pessoa WHERE lower(email) = $1 AND email_confirmado_em IS NOT NULL', [email])).rows[0].id as string;
    await amb.admin.query(
      "INSERT INTO usuario (instituicao_id, perfil, nome, email, pessoa_id) VALUES ($1,'pedagogico','Suspenso',$2,$3)",
      [amb.instB, email, pessoa],
    );
    const ck = cookieDe(await entrar(email));
    expect((await chamar('GET', '/auth/pessoa/eu', undefined, ck)).json().espacos).toHaveLength(1);
    await amb.admin.query("UPDATE instituicao SET situacao = 'suspensa' WHERE id = $1", [amb.instB]);
    expect((await chamar('GET', '/auth/pessoa/eu', undefined, ck)).json().espacos).toHaveLength(0);
    expect((await chamar('POST', '/auth/pessoa/entrar', { instituicao_id: amb.instB }, ck)).statusCode).toBe(403);
    await amb.admin.query("UPDATE instituicao SET situacao = 'ativa' WHERE id = $1", [amb.instB]);
    const sai = await chamar('POST', '/auth/pessoa/logout', undefined, ck);
    expect(sai.statusCode).toBe(204);
    expect((await chamar('GET', '/auth/pessoa/eu', undefined, ck)).statusCode).toBe(401);
  });

  it('a aplicação não lê as tabelas da pessoa diretamente', async () => {
    for (const t of ['credencial_pessoa', 'sessao_pessoa', 'pedido_email_pessoa', 'pessoa']) {
      const r = await amb.bancoApp.$queryRawUnsafe(`SELECT 1 FROM ${t} LIMIT 1`).then(
        () => 'leu',
        (e: unknown) => String(e),
      );
      expect(r, t).toMatch(/permission denied/);
    }
  });
});
