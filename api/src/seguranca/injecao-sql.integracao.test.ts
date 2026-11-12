import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { hashSenha } from '../auth/senha.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// L21a: injeção de SQL. Textos de ataque entram por todas as rotas; nenhuma pode dar erro 500,
// vazar mensagem do banco, nem alterar ou apagar tabela. Só dados fictícios.
const SENHA = 'senha de teste longa 123';
const ATAQUES = [
  "'; DROP TABLE usuario; --",
  "' OR '1'='1",
  "x'); DELETE FROM tarefa; --",
  '1; SELECT pg_sleep(5)',
  "\\'; TRUNCATE auditoria; --",
  '$' + '{7*7}{{7*7}}',
];
const PERFIS = ['aluno', 'professor', 'pedagogico', 'admin', 'responsavel'] as const;
const ROTAS: { metodo: string; url: string }[] = [];
let amb: Ambiente;
let app: FastifyInstance;
const cookies: Record<string, string> = {};

async function criar(perfil: string) {
  const id = randomUUID();
  const email = `${perfil}-${id.slice(0, 8)}@inj.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
    [id, amb.instA, perfil, `Pessoa ${perfil}`, email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
    [amb.instA, id, await hashSenha(SENHA)],
  );
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { instituicao_id: amb.instA, email, senha: SENHA },
  });
  expect(r.statusCode, r.body).toBe(200);
  cookies[perfil] = String(r.headers['set-cookie']).split(';')[0] as string;
}

const contagens = async () => {
  const q = await amb.admin.query(
    `SELECT (SELECT count(*) FROM usuario) AS u, (SELECT count(*) FROM credencial) AS c,
            (SELECT count(*) FROM auditoria_evento) AS a, (SELECT count(*) FROM instituicao) AS i`,
  );
  return q.rows[0] as Record<string, string>;
};
// O texto de ataque pode voltar na resposta (a API devolve o que guardou, ou o endereço pedido); isso não conta.
const vazaBanco = (corpoBruto: string) => {
  let corpo = corpoBruto;
  for (const a of ATAQUES) corpo = corpo.split(a).join('').split(encodeURIComponent(a)).join('');
  return /syntax error|prisma|postgres|pg_|relation ".*" does not exist|violates|SQLSTATE/i.test(corpo);
};

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => new Date('2026-11-12T12:00:00Z'),
    limiteTentativasPorMinuto: 100000,
    aoRegistrarRota: (metodo, url) => {
      for (const m of [metodo].flat()) ROTAS.push({ metodo: m, url });
    },
  });
  for (const p of PERFIS) await criar(p);
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('injeção de SQL: rotas com corpo válido', () => {
  it('o texto de ataque é guardado como texto e as tabelas continuam intactas', async () => {
    const antes = await contagens();
    for (const ataque of ATAQUES) {
      const t = await app.inject({
        method: 'POST',
        url: '/tarefas',
        payload: { titulo: ataque.slice(0, 80) },
        headers: { cookie: cookies.aluno as string },
      });
      expect(t.statusCode, t.body).toBeLessThan(500);
      expect(vazaBanco(t.body)).toBe(false);
      if (t.statusCode === 201) {
        const q = await amb.admin.query('SELECT titulo FROM tarefa WHERE id = $1', [
          t.json().tarefa.id,
        ]);
        expect(q.rows[0].titulo).toBe(ataque.slice(0, 80).trim());
      }
      const d = await app.inject({
        method: 'POST',
        url: '/minhas-disciplinas',
        payload: { nome: ataque.slice(0, 60) },
        headers: { cookie: cookies.aluno as string },
      });
      expect(d.statusCode, d.body).toBeLessThan(500);
      expect(vazaBanco(d.body)).toBe(false);
      const e = await app.inject({
        method: 'POST',
        url: '/eventos',
        payload: {
          titulo: ataque.slice(0, 80),
          tipo: 'estudo',
          dia: '2026-11-13',
          hora_inicio: '15:00',
          minutos: 25,
        },
        headers: { cookie: cookies.aluno as string },
      });
      expect(e.statusCode, e.body).toBeLessThan(500);
      const tu = await app.inject({
        method: 'POST',
        url: '/turmas',
        payload: { nome: ataque.slice(0, 80), ano_letivo: 2026, turno: 'manha' },
        headers: { cookie: cookies.admin as string },
      });
      expect(tu.statusCode, tu.body).toBeLessThan(500);
      const login = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { instituicao_id: amb.instA, email: ataque, senha: ataque },
      });
      expect(login.statusCode, login.body).toBeLessThan(500);
      expect(login.statusCode).not.toBe(200);
      expect(vazaBanco(login.body)).toBe(false);
    }
    const depois = await contagens();
    expect(depois.u).toBe(antes.u);
    expect(depois.c).toBe(antes.c);
    expect(depois.i).toBe(antes.i);
    expect(Number(depois.a)).toBeGreaterThanOrEqual(Number(antes.a));
    // as tabelas atacadas ainda existem
    const t = await amb.admin.query(
      `SELECT count(*) FROM pg_tables WHERE tablename IN ('usuario','tarefa','auditoria_evento','credencial')`,
    );
    expect(Number(t.rows[0].count)).toBe(4);
  });
});

describe('injeção de SQL: varredura de todas as rotas registradas', () => {
  // As rotas vêm do próprio Fastify (gancho onRoute); rota nova entra sozinha na varredura.
  const rotas = () =>
    ROTAS.filter((r) => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(r.metodo)).map((r) => ({
      metodo: r.metodo,
      url: r.url.replace(/:[A-Za-z_]+/g, randomUUID()),
    }));

  it('acha rotas (a varredura não pode ficar vazia)', async () => {
    await app.ready();
    expect(rotas().length).toBeGreaterThan(40);
  });

  it('nenhuma rota dá erro 500 nem vaza o banco com texto de ataque (sem sessão e com os 5 perfis)', async () => {
    await app.ready();
    const antes = await contagens();
    const campos = [
      'titulo',
      'nome',
      'texto',
      'descricao',
      'email',
      'senha',
      'disciplina',
      'assunto',
      'mensagem',
      'frente',
      'verso',
      'codigo',
      'q',
      'busca',
      'instituicao_id',
      'convite',
      'token',
    ];
    const falhas: string[] = [];
    for (const { metodo, url } of rotas()) {
      for (const quem of [undefined, ...PERFIS]) {
        const ataque = ATAQUES[(url.length + (quem?.length ?? 0)) % ATAQUES.length] as string;
        const corpo = Object.fromEntries(campos.map((c) => [c, ataque]));
        const semCorpo = metodo === 'GET' || metodo === 'DELETE';
        const qs = `?${campos.map((c) => `${c}=${encodeURIComponent(ataque)}`).join('&')}`;
        const r = await app.inject({
          method: metodo as 'GET',
          url: url + (semCorpo ? qs : ''),
          ...(semCorpo ? {} : { payload: corpo }),
          headers: quem ? { cookie: cookies[quem] as string } : {},
        });
        if (r.statusCode >= 500 || vazaBanco(r.body))
          falhas.push(
            `${metodo} ${url} (${quem ?? 'sem sessão'}) -> ${r.statusCode} ${r.body.slice(0, 120)}`,
          );
      }
    }
    expect(falhas, falhas.join('\n')).toEqual([]);
    const depois = await contagens();
    expect(depois.u).toBe(antes.u);
    expect(depois.i).toBe(antes.i);
  }, 300_000);
});
