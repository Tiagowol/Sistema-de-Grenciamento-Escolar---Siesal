import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { verificarCadeia } from '../auditoria/auditoria.js';
import { hashSenha } from '../auth/senha.js';
import { withTenant } from '../banco/withTenant.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// Núcleo do aluno (tarefas, microetapas, plano, agenda, sessões, notas, notificações). Hoje fictício: 10/11/2026.
const SENHA = 'senha de teste longa 123';
let amb: Ambiente;
let app: FastifyInstance;
let a: string; // cookie do aluno A (instituição A)
let b: string; // cookie do aluno B (mesma instituição)
let c: string; // cookie do aluno C (outra instituição)
let prof: string; // cookie de professor

const cookieDe = (r: { headers: Record<string, unknown> }) =>
  String(r.headers['set-cookie']).split(';')[0] as string;
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

async function entrar(inst: string, perfil: string, apelido: string): Promise<string> {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@n.exemplo`;
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
  return cookieDe(r);
}

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => new Date('2026-11-10T12:00:00Z'),
    limiteTentativasPorMinuto: 1000,
  });
  a = await entrar(amb.instA, 'aluno', 'a');
  b = await entrar(amb.instA, 'aluno', 'b');
  c = await entrar(amb.instB, 'aluno', 'c');
  prof = await entrar(amb.instA, 'professor', 'prof');
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('acesso', () => {
  it('sem sessão 401; professor 403; dados inválidos 400', async () => {
    expect((await chamar('GET', '/tarefas')).statusCode).toBe(401);
    expect((await chamar('GET', '/tarefas', prof)).statusCode).toBe(403);
    expect((await chamar('POST', '/tarefas', a, { titulo: '' })).statusCode).toBe(400);
    expect((await chamar('POST', '/tarefas', a, { titulo: 'x', extra: 1 })).statusCode).toBe(400);
    expect(
      (await chamar('POST', '/tarefas', a, { titulo: 'x', prazo: '2026-13-40' })).statusCode,
    ).toBe(400);
  });
});

describe('tarefas e microetapas', () => {
  let id: string;
  it('cria com microetapas, lista, marca etapa e conclui', async () => {
    const r = await chamar('POST', '/tarefas', a, {
      titulo: 'Resumo de História',
      disciplina: 'História',
      prazo: '2026-11-20',
      prioridade: 'alta',
      microetapas: ['Ler capítulo 3', 'Escrever tópicos'],
    });
    expect(r.statusCode).toBe(201);
    id = r.json().tarefa.id;
    expect(r.json().tarefa.microetapas.map((m: { texto: string }) => m.texto)).toEqual([
      'Ler capítulo 3',
      'Escrever tópicos',
    ]);
    const etapa = r.json().tarefa.microetapas[0].id;
    const m = await chamar('PATCH', `/microetapas/${etapa}`, a, { feita: true });
    expect(m.json().tarefa.microetapas[0].feita).toBe(true);
    const nova = await chamar('POST', `/tarefas/${id}/microetapas`, a, { texto: 'Revisar' });
    expect(nova.json().tarefa.microetapas).toHaveLength(3);
    const fim = await chamar('PATCH', `/tarefas/${id}`, a, { situacao: 'concluida' });
    expect(fim.json(), fim.body).toHaveProperty('tarefa');
    expect(fim.json().tarefa.situacao).toBe('concluida');
  });
  it('outro aluno da mesma instituição não vê nem altera', async () => {
    expect((await chamar('GET', '/tarefas', b)).json().tarefas).toEqual([]);
    expect((await chamar('PATCH', `/tarefas/${id}`, b, { titulo: 'invadido' })).statusCode).toBe(
      404,
    );
    expect((await chamar('DELETE', `/tarefas/${id}`, b)).statusCode).toBe(404);
    expect((await chamar('POST', `/tarefas/${id}/microetapas`, b, { texto: 'x' })).statusCode).toBe(
      404,
    );
  });
  it('aluno de outra instituição não vê (RLS) e o banco sem contexto não devolve linhas', async () => {
    expect((await chamar('GET', '/tarefas', c)).json().tarefas).toEqual([]);
    const linhas = await amb.bancoApp.$queryRaw<unknown[]>`SELECT id FROM tarefa`;
    expect(linhas).toHaveLength(0);
    const outra = await withTenant(
      amb.bancoApp,
      { instituicaoId: amb.instB },
      (tx) => tx.$queryRaw<unknown[]>`SELECT id FROM tarefa`,
    );
    expect(outra).toHaveLength(0);
  });
  it('desativar esconde a tarefa e nada some do banco', async () => {
    expect((await chamar('DELETE', `/tarefas/${id}`, a)).statusCode).toBe(204);
    expect((await chamar('GET', '/tarefas', a)).json().tarefas).toEqual([]);
    const { rows } = await amb.admin.query('SELECT desativado_em FROM tarefa WHERE id = $1', [id]);
    expect(rows[0].desativado_em).not.toBeNull();
  });
  it('auditoria registra e a cadeia continua íntegra', async () => {
    const { rows } = await amb.admin.query(
      "SELECT acao FROM auditoria_evento WHERE acao LIKE 'tarefa.%' ORDER BY seq",
    );
    expect(rows.map((r) => r.acao)).toEqual(
      expect.arrayContaining(['tarefa.criada', 'tarefa.concluida', 'tarefa.desativada']),
    );
    const problemas = await withTenant(amb.bancoApp, { instituicaoId: amb.instA }, (tx) =>
      verificarCadeia(tx),
    );
    expect(problemas).toEqual([]);
  });
});

describe('plano regressivo e agenda', () => {
  it('exige prazo; gera blocos que terminam na véspera; regerar substitui', async () => {
    const sem = (await chamar('POST', '/tarefas', a, { titulo: 'Sem prazo' })).json().tarefa.id;
    expect(
      (
        await chamar('POST', `/tarefas/${sem}/plano`, a, {
          minutos_total: 60,
          minutos_por_sessao: 30,
        })
      ).statusCode,
    ).toBe(422);
    const id = (
      await chamar('POST', '/tarefas', a, {
        titulo: 'Prova de Ciências',
        tipo: 'prova',
        prazo: '2026-11-20',
      })
    ).json().tarefa.id;
    const p = await chamar('POST', `/tarefas/${id}/plano`, a, {
      minutos_total: 120,
      minutos_por_sessao: 30,
    });
    expect(p.statusCode).toBe(200);
    expect(p.json().blocos).toHaveLength(4);
    expect(p.json().blocos.at(-1).dia).toBe('2026-11-19');
    await chamar('POST', `/tarefas/${id}/plano`, a, { minutos_total: 60, minutos_por_sessao: 30 });
    const ev = (await chamar('GET', '/eventos?de=2026-11-10&ate=2026-11-30', a)).json().eventos;
    expect(ev.filter((e: { origem: string }) => e.origem === 'plano')).toHaveLength(2);
    expect(
      (await chamar('GET', '/eventos?de=2026-11-10&ate=2026-11-30', b)).json().eventos,
    ).toEqual([]);
  });
  it('cria, lista por intervalo e remove evento', async () => {
    const r = await chamar('POST', '/eventos', a, {
      titulo: 'Aula de Matemática',
      tipo: 'aula',
      dia: '2026-11-12',
      hora_inicio: '07:30',
      minutos: 50,
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().evento.hora_inicio).toBe('07:30');
    expect(
      (
        await chamar('POST', '/eventos', a, {
          titulo: 'x',
          dia: '2026-11-12',
          hora_inicio: '25:00',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await chamar('GET', '/eventos?de=2026-11-13&ate=2026-11-14', a))
        .json()
        .eventos.filter((e: { origem: string }) => e.origem === 'manual'),
    ).toEqual([]);
    expect((await chamar('DELETE', `/eventos/${r.json().evento.id}`, b)).statusCode).toBe(404);
    expect((await chamar('DELETE', `/eventos/${r.json().evento.id}`, a)).statusCode).toBe(204);
  });
});

describe('sessões de estudo', () => {
  it('uma por vez; encerra e calcula minutos no servidor', async () => {
    const s = await chamar('POST', '/sessoes', a, { minutos_planejados: 25 });
    expect(s.statusCode).toBe(201);
    expect((await chamar('POST', '/sessoes', a, { minutos_planejados: 25 })).statusCode).toBe(409);
    expect((await chamar('GET', '/sessoes/atual', a)).json().sessao.id).toBe(s.json().sessao.id);
    expect((await chamar('GET', '/sessoes/atual', b)).json().sessao).toBeNull();
    expect(
      (
        await chamar('POST', `/sessoes/${s.json().sessao.id}/encerrar`, b, {
          situacao: 'concluida',
        })
      ).statusCode,
    ).toBe(404);
    const fim = await chamar('POST', `/sessoes/${s.json().sessao.id}/encerrar`, a, {
      situacao: 'interrompida',
    });
    expect(fim.statusCode).toBe(200);
    expect(fim.json().minutos_reais).toBeGreaterThanOrEqual(0);
    expect((await chamar('GET', '/sessoes/atual', a)).json().sessao).toBeNull();
    expect((await chamar('POST', '/sessoes', a, { minutos_planejados: 3 })).statusCode).toBe(400);
  });
});

describe('notas pessoais', () => {
  it('valida 0 a 10, calcula média só do próprio aluno', async () => {
    expect(
      (
        await chamar('POST', '/notas-pessoais', a, {
          disciplina: 'Matemática',
          valor: 11,
          dia: '2026-11-05',
        })
      ).statusCode,
    ).toBe(400);
    await chamar('POST', '/notas-pessoais', a, {
      disciplina: 'Matemática',
      valor: 7,
      dia: '2026-11-05',
    });
    await chamar('POST', '/notas-pessoais', a, {
      disciplina: 'Matemática',
      valor: 8.5,
      dia: '2026-11-06',
      descricao: 'Prova 2',
    });
    const r = (await chamar('GET', '/notas-pessoais', a)).json();
    expect(r.notas).toHaveLength(2);
    expect(r.medias).toEqual([{ disciplina: 'Matemática', media: 7.8, quantidade: 2 }]);
    expect((await chamar('GET', '/notas-pessoais', b)).json()).toEqual({ notas: [], medias: [] });
  });
});

describe('notificações e Meu dia', () => {
  it('gera lembretes de prazo uma vez por dia e permite marcar como lida', async () => {
    await chamar('POST', '/tarefas', c, { titulo: 'Tarefa de C', prazo: '2026-11-10' });
    for (const [titulo, prazo] of [
      ['Hoje', '2026-11-10'],
      ['Amanhã', '2026-11-11'],
      ['Atrasada', '2026-11-08'],
      ['Longe', '2026-12-30'],
    ]) {
      await chamar('POST', '/tarefas', b, { titulo, prazo });
    }
    const um = (await chamar('GET', '/notificacoes', b)).json();
    expect(um.notificacoes.map((n: { titulo: string }) => n.titulo).sort()).toEqual([
      'Prazo amanhã: Amanhã',
      'Prazo hoje: Hoje',
      'Prazo já passou: Atrasada',
    ]);
    expect(um.nao_lidas).toBe(3);
    const dois = (await chamar('GET', '/notificacoes', b)).json();
    expect(dois.notificacoes).toHaveLength(3);
    expect(
      (await chamar('POST', `/notificacoes/${um.notificacoes[0].id}/lida`, c)).statusCode,
    ).toBe(404);
    expect(
      (await chamar('POST', `/notificacoes/${um.notificacoes[0].id}/lida`, b)).statusCode,
    ).toBe(204);
    expect((await chamar('GET', '/notificacoes', b)).json().nao_lidas).toBe(2);
    expect((await chamar('POST', '/notificacoes/lidas', b)).statusCode).toBe(204);
    expect((await chamar('GET', '/notificacoes', b)).json().nao_lidas).toBe(0);
    expect((await chamar('GET', '/notificacoes', c)).json().notificacoes).toHaveLength(1);
  });
  it('Meu dia separa atrasadas, hoje e próximas', async () => {
    const d = (await chamar('GET', '/meu-dia', b)).json();
    expect(d.hoje).toBe('2026-11-10');
    expect(d.atrasadas.map((t: { titulo: string }) => t.titulo)).toEqual(['Atrasada']);
    expect(d.para_hoje.map((t: { titulo: string }) => t.titulo)).toEqual(['Hoje']);
    expect(d.proximas.map((t: { titulo: string }) => t.titulo)).toEqual(['Amanhã']);
    expect(d.tarefas_total).toBe(4);
  });
});
