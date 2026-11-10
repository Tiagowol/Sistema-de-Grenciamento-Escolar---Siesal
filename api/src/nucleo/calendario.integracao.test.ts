import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { verificarCadeia } from '../auditoria/auditoria.js';
import { hashSenha } from '../auth/senha.js';
import { withTenant } from '../banco/withTenant.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// Calendário do aluno (L17a, migração 0011): mesma tabela da Agenda, versões append-only, ocultar evento
// importado, isolamento entre alunos e entre instituições, perfil sem permissão negado. Só dados fictícios.
const SENHA = 'senha de teste longa 123';
let amb: Ambiente;
let app: FastifyInstance;
let a: string;
let b: string;
let c: string;
let prof: string;

const chamar = (
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  cookie?: string,
  payload?: unknown,
) =>
  app.inject({
    method: metodo,
    url,
    payload: payload as object,
    headers: cookie ? { cookie } : {},
  });

async function entrar(inst: string, perfil: string, apelido: string) {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@c.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
    [id, inst, perfil, `Pessoa ${apelido}`, email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
    [inst, id, await hashSenha(SENHA)],
  );
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { instituicao_id: inst, email, senha: SENHA },
  });
  expect(r.statusCode).toBe(200);
  return { cookie: String(r.headers['set-cookie']).split(';')[0] as string, id };
}

const ids: Record<string, string> = {};
const versoes = async (eventoId: string) =>
  (
    await amb.admin.query(
      'SELECT versao, acao FROM evento_versao WHERE evento_id = $1 ORDER BY versao',
      [eventoId],
    )
  ).rows as { versao: number; acao: string }[];

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => new Date('2026-11-10T12:00:00Z'),
    limiteTentativasPorMinuto: 1000,
  });
  const ea = await entrar(amb.instA, 'aluno', 'a');
  a = ea.cookie;
  ids.a = ea.id;
  b = (await entrar(amb.instA, 'aluno', 'b')).cookie;
  c = (await entrar(amb.instB, 'aluno', 'c')).cookie;
  prof = (await entrar(amb.instA, 'professor', 'prof')).cookie;
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('acesso ao calendário', () => {
  it('sem sessão 401; professor 403; intervalo grande demais ou invertido 400', async () => {
    expect((await chamar('GET', '/eventos?de=2026-11-01&ate=2026-11-30')).statusCode).toBe(401);
    expect((await chamar('GET', '/eventos?de=2026-11-01&ate=2026-11-30', prof)).statusCode).toBe(
      403,
    );
    expect((await chamar('GET', '/eventos?de=2026-01-01&ate=2028-01-01', a)).statusCode).toBe(400);
    expect((await chamar('GET', '/eventos?de=2026-11-30&ate=2026-11-01', a)).statusCode).toBe(400);
  });
});

describe('criar, editar, desativar com versões', () => {
  it('cada passo grava uma versão e a auditoria; nada é apagado', async () => {
    const r = await chamar('POST', '/eventos', a, {
      titulo: 'Entregar trabalho de Artes',
      tipo: 'trabalho',
      dia: '2026-11-18',
    });
    expect(r.statusCode).toBe(201);
    const id = r.json().evento.id as string;
    expect(r.json().evento.origem).toBe('manual');
    const e = await chamar('PATCH', `/eventos/${id}`, a, {
      titulo: 'Entregar trabalho de Artes (cartaz)',
      tipo: 'trabalho',
      dia: '2026-11-19',
      hora_inicio: '09:00',
      minutos: 25,
    });
    expect(e.statusCode, e.body).toBe(200);
    expect(e.json().evento.dia).toBe('2026-11-19');
    expect((await chamar('DELETE', `/eventos/${id}`, a)).statusCode).toBe(204);
    expect((await versoes(id)).map((v) => v.acao)).toEqual(['criado', 'editado', 'desativado']);
    // a linha continua no banco, só desativada
    const linha = await amb.admin.query('SELECT desativado_em FROM evento WHERE id = $1', [id]);
    expect(linha.rows[0].desativado_em).not.toBeNull();
    expect(
      (await chamar('GET', '/eventos?de=2026-11-01&ate=2026-11-30', a)).json().eventos,
    ).toEqual([]);
    // evento desativado não se edita
    expect(
      (
        await chamar('PATCH', `/eventos/${id}`, a, {
          titulo: 'x',
          dia: '2026-11-19',
        })
      ).statusCode,
    ).toBe(404);
    const acoes = await amb.admin.query(
      'SELECT acao FROM auditoria_evento WHERE alvo = $1 ORDER BY seq',
      [`evento:${id}`],
    );
    expect(acoes.rows.map((x: { acao: string }) => x.acao)).toEqual([
      'evento.criado',
      'evento.editado',
      'evento.desativado',
    ]);
  });

  it('versões são append-only: nem o aplicativo altera ou apaga', async () => {
    const r = await chamar('POST', '/eventos', a, {
      titulo: 'Lembrete',
      tipo: 'lembrete',
      dia: '2026-11-12',
    });
    const id = r.json().evento.id as string;
    await expect(
      withTenant(
        amb.bancoApp,
        { instituicaoId: amb.instA },
        (tx) => tx.$executeRaw`UPDATE evento_versao SET titulo = 'x' WHERE evento_id = ${id}::uuid`,
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(
        amb.bancoApp,
        { instituicaoId: amb.instA },
        (tx) => tx.$executeRaw`DELETE FROM evento_versao WHERE evento_id = ${id}::uuid`,
      ),
    ).rejects.toThrow();
  });
});

describe('evento importado: só se oculta', () => {
  it('não edita nem remove; ocultar some da lista e grava versão', async () => {
    const id = randomUUID();
    await amb.admin.query(
      `INSERT INTO evento (instituicao_id, id, usuario_id, titulo, tipo, origem, id_externo, dia)
       VALUES ($1,$2,$3,'Aula importada','aula','google_agenda','g-123','2026-11-12')`,
      [amb.instA, id, ids.a],
    );
    // mesmo id externo na mesma origem para o mesmo aluno não duplica
    await expect(
      amb.admin.query(
        `INSERT INTO evento (instituicao_id, usuario_id, titulo, tipo, origem, id_externo, dia)
         VALUES ($1,$2,'Repetida','aula','google_agenda','g-123','2026-11-12')`,
        [amb.instA, ids.a],
      ),
    ).rejects.toThrow();
    const lista = (await chamar('GET', '/eventos?de=2026-11-12&ate=2026-11-12', a)).json().eventos;
    expect(lista.find((x: { id: string }) => x.id === id).origem).toBe('google_agenda');
    expect(
      (await chamar('PATCH', `/eventos/${id}`, a, { titulo: 'x', dia: '2026-11-12' })).statusCode,
    ).toBe(404);
    expect((await chamar('DELETE', `/eventos/${id}`, a)).statusCode).toBe(404);
    expect((await chamar('POST', `/eventos/${id}/ocultar`, b)).statusCode).toBe(404);
    expect((await chamar('POST', `/eventos/${id}/ocultar`, a)).statusCode).toBe(204);
    expect(
      (await chamar('GET', '/eventos?de=2026-11-12&ate=2026-11-12', a))
        .json()
        .eventos.some((x: { id: string }) => x.id === id),
    ).toBe(false);
    expect((await versoes(id)).map((v) => v.acao)).toEqual(['ocultado']);
    // ocultar duas vezes não repete
    expect((await chamar('POST', `/eventos/${id}/ocultar`, a)).statusCode).toBe(404);
  });
});

describe('isolamento', () => {
  it('um aluno não vê, edita, oculta nem remove evento de outro (mesma instituição ou outra)', async () => {
    const r = await chamar('POST', '/eventos', a, {
      titulo: 'Só meu',
      tipo: 'pessoal',
      dia: '2026-11-14',
    });
    const id = r.json().evento.id as string;
    for (const outro of [b, c]) {
      expect(
        (await chamar('GET', '/eventos?de=2026-11-14&ate=2026-11-14', outro)).json().eventos,
      ).toEqual([]);
      expect(
        (await chamar('PATCH', `/eventos/${id}`, outro, { titulo: 'x', dia: '2026-11-14' }))
          .statusCode,
      ).toBe(404);
      expect((await chamar('POST', `/eventos/${id}/ocultar`, outro)).statusCode).toBe(404);
      expect((await chamar('DELETE', `/eventos/${id}`, outro)).statusCode).toBe(404);
    }
    // a RLS barra a leitura direta de evento_versao pela instituição errada
    const vistas = await withTenant(
      amb.bancoApp,
      { instituicaoId: amb.instB },
      (tx) => tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM evento_versao`,
    );
    expect(vistas[0]?.n).toBe(0);
  });

  it('tipo e dados inválidos são recusados', async () => {
    expect(
      (await chamar('POST', '/eventos', a, { titulo: 'x', tipo: 'qualquer', dia: '2026-11-14' }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await chamar('POST', '/eventos', a, {
          titulo: 'x',
          dia: '2026-11-14',
          origem: 'google_agenda',
        })
      ).statusCode,
    ).toBe(400);
  });

  it('a cadeia de auditoria continua íntegra', async () => {
    expect(
      await withTenant(amb.bancoApp, { instituicaoId: amb.instA }, (tx) => verificarCadeia(tx)),
    ).toEqual([]);
  });
});
