import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { hashSenha } from '../auth/senha.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// 20d (migração 0023): dificuldade de 0 a 10, visão do Pedagógico/NAPNE (um aluno por vez) e cards de resumo.
// Só dados fictícios.
const SENHA = 'senha de teste longa 123';
let amb: Ambiente;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
const ids: Record<string, string> = {};

const chamar = (
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  quem?: string,
  payload?: unknown,
) =>
  app.inject({
    method: metodo,
    url,
    payload: payload as object,
    headers: quem ? { cookie: cookies[quem] as string } : {},
  });

async function criar(instituicao: string, perfil: string, apelido: string) {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@ap.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
    [id, instituicao, perfil, `Pessoa ${apelido}`, email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
    [instituicao, id, await hashSenha(SENHA)],
  );
  ids[apelido] = id;
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { instituicao_id: instituicao, email, senha: SENHA },
  });
  expect(r.statusCode, r.body).toBe(200);
  cookies[apelido] = String(r.headers['set-cookie']).split(';')[0] as string;
}
// A API responde antes do fim da transação (a resposta sai de dentro do withTenant). Para ler pelo administrador,
// o teste espera a linha aparecer.
const esperarLinha = async (tabela: 'tarefa' | 'disciplina_aluno', id: string) => {
  for (let i = 0; i < 100; i++) {
    const q = await amb.admin.query(`SELECT 1 FROM ${tabela} WHERE id = $1`, [id]);
    if (q.rows.length) return;
    await new Promise((ok) => setTimeout(ok, 20));
  }
  throw new Error(`linha de ${tabela} não apareceu`);
};
const novaDisciplina = async (quem: string, nome: string) => {
  const r = await chamar('POST', '/minhas-disciplinas', quem, { nome });
  expect(r.statusCode, r.body).toBe(201);
  const id = r.json().disciplina.id as string;
  await esperarLinha('disciplina_aluno', id);
  return id;
};
const novaTarefa = async (quem: string, extra: Record<string, unknown> = {}) => {
  const r = await chamar('POST', '/tarefas', quem, { titulo: 'Tarefa fictícia', ...extra });
  expect(r.statusCode, r.body).toBe(201);
  const t = r.json().tarefa as { id: string; dificuldade: number | null };
  await esperarLinha('tarefa', t.id);
  return t;
};

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => new Date('2026-11-12T12:00:00Z'),
    limiteTentativasPorMinuto: 1000,
  });
  await criar(amb.instA, 'aluno', 'a');
  await criar(amb.instA, 'aluno', 'b');
  await criar(amb.instB, 'aluno', 'c');
  await criar(amb.instA, 'pedagogico', 'ped');
  await criar(amb.instB, 'pedagogico', 'pedb');
  await criar(amb.instA, 'professor', 'prof');
  await criar(amb.instA, 'admin', 'adm');
  await criar(amb.instA, 'responsavel', 'resp');
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('dificuldade do aluno', () => {
  it('tarefa: grava de 0 a 10, lê, limpa com null e recusa fora da faixa', async () => {
    const t = await novaTarefa('a', { dificuldade: 7 });
    expect(t.dificuldade).toBe(7);
    const lista = await chamar('GET', '/tarefas', 'a');
    expect(lista.json().tarefas.find((x: { id: string }) => x.id === t.id).dificuldade).toBe(7);
    const zero = await chamar('PATCH', `/tarefas/${t.id}`, 'a', { dificuldade: 0 });
    expect(zero.json().tarefa.dificuldade).toBe(0);
    const limpa = await chamar('PATCH', `/tarefas/${t.id}`, 'a', { dificuldade: null });
    expect(limpa.json().tarefa.dificuldade).toBeNull();
    for (const ruim of [11, -1, 5.5, '7'])
      expect((await chamar('PATCH', `/tarefas/${t.id}`, 'a', { dificuldade: ruim })).statusCode).toBe(400);
    // outro campo não mexe na dificuldade
    await chamar('PATCH', `/tarefas/${t.id}`, 'a', { dificuldade: 4 });
    const so = await chamar('PATCH', `/tarefas/${t.id}`, 'a', { titulo: 'Outro título' });
    expect(so.json().tarefa.dificuldade).toBe(4);
  });

  it('disciplina: o aluno marca a própria; a de outro aluno não é achada; limpa com null', async () => {
    const d = await novaDisciplina('a', 'Matemática Fictícia');
    const ok = await chamar('PUT', `/minhas-disciplinas/${d}/dificuldade`, 'a', { dificuldade: 8 });
    expect(ok.statusCode, ok.body).toBe(200);
    const lista = await chamar('GET', '/minhas-disciplinas', 'a');
    expect(lista.json().minhas.find((x: { id: string }) => x.id === d).dificuldade).toBe(8);
    expect((await chamar('PUT', `/minhas-disciplinas/${d}/dificuldade`, 'b', { dificuldade: 1 })).statusCode).toBe(404);
    expect((await chamar('PUT', `/minhas-disciplinas/${d}/dificuldade`, 'c', { dificuldade: 1 })).statusCode).toBe(404);
    expect((await chamar('PUT', `/minhas-disciplinas/${d}/dificuldade`, 'a', { dificuldade: 12 })).statusCode).toBe(400);
    expect((await chamar('PUT', `/minhas-disciplinas/${d}/dificuldade`, 'a', {})).statusCode).toBe(400);
    const limpa = await chamar('PUT', `/minhas-disciplinas/${d}/dificuldade`, 'a', { dificuldade: null });
    expect(limpa.json().dificuldade).toBeNull();
  });

  it('só o aluno marca: professor, Pedagógico, Admin e Responsável recebem 403', async () => {
    const d = await novaDisciplina('b', 'Física Fictícia');
    for (const quem of ['prof', 'ped', 'adm', 'resp'])
      expect((await chamar('PUT', `/minhas-disciplinas/${d}/dificuldade`, quem, { dificuldade: 3 })).statusCode, quem).toBe(403);
    expect((await chamar('PUT', `/minhas-disciplinas/${d}/dificuldade`, undefined, { dificuldade: 3 })).statusCode).toBe(401);
  });
});

describe('visão do Pedagógico/NAPNE', () => {
  it('lista os alunos só com o nome e abre um aluno por vez, com disciplinas e tarefas que têm nota', async () => {
    const d = await novaDisciplina('a', 'Química Fictícia');
    await chamar('PUT', `/minhas-disciplinas/${d}/dificuldade`, 'a', { dificuldade: 9 });
    await novaTarefa('a', { titulo: 'Tarefa difícil', dificuldade: 10 });
    await novaTarefa('a', { titulo: 'Tarefa sem nota' });
    const lista = await chamar('GET', '/apoio/alunos', 'ped');
    expect(lista.statusCode, lista.body).toBe(200);
    const alunos = lista.json().alunos as Record<string, unknown>[];
    expect(alunos.map((x) => x.id)).toEqual(expect.arrayContaining([ids.a, ids.b]));
    // nenhum valor de dificuldade na lista e nenhum aluno de outra instituição
    expect(alunos.every((x) => Object.keys(x).sort().join() === 'id,nome')).toBe(true);
    expect(alunos.map((x) => x.id)).not.toContain(ids.c);
    expect(lista.body).not.toContain('dificuldade');

    const um = await chamar('GET', `/apoio/alunos/${ids.a}/dificuldades`, 'ped');
    expect(um.statusCode, um.body).toBe(200);
    const corpo = um.json();
    expect(corpo.aluno.id).toBe(ids.a);
    expect(corpo.disciplinas.map((x: { nome: string; dificuldade: number }) => [x.nome, x.dificuldade])).toContainEqual(['Química Fictícia', 9]);
    expect(corpo.tarefas.map((x: { titulo: string }) => x.titulo)).toContain('Tarefa difícil');
    expect(corpo.tarefas.map((x: { titulo: string }) => x.titulo)).not.toContain('Tarefa sem nota');
    // o corpo traz só este aluno
    expect(JSON.stringify(corpo)).not.toContain(ids.b as string);
  });

  it('cada leitura pela equipe gera auditoria, sem o valor da nota', async () => {
    await chamar('GET', `/apoio/alunos/${ids.a}/dificuldades`, 'ped');
    const q = await amb.admin.query(
      "SELECT ator, alvo, antes, depois FROM auditoria_evento WHERE acao = 'dificuldade.lida' AND alvo = $1",
      [`usuario:${ids.a}`],
    );
    expect(q.rows.length).toBeGreaterThanOrEqual(1);
    expect(q.rows.every((l: { ator: string }) => l.ator === `usuario:${ids.ped}`)).toBe(true);
    expect(JSON.stringify(q.rows)).not.toMatch(/"dificuldade"|\b10\b/);
  });

  it('professor, Admin, Responsável, aluno e Master não leem; sem sessão 401; a tentativa é auditada', async () => {
    for (const quem of ['prof', 'adm', 'resp', 'a', 'b']) {
      expect((await chamar('GET', '/apoio/alunos', quem)).statusCode, quem).toBe(403);
      expect((await chamar('GET', `/apoio/alunos/${ids.a}/dificuldades`, quem)).statusCode, quem).toBe(403);
    }
    expect((await chamar('GET', '/apoio/alunos')).statusCode).toBe(401);
    const q = await amb.admin.query("SELECT 1 FROM auditoria_evento WHERE acao = 'apoio.acesso_negado'");
    expect(q.rows.length).toBeGreaterThan(0);
  });

  it('o Pedagógico de outra instituição não acha o aluno (isolamento)', async () => {
    const r = await chamar('GET', `/apoio/alunos/${ids.a}/dificuldades`, 'pedb');
    expect(r.statusCode).toBe(404);
    const lista = await chamar('GET', '/apoio/alunos', 'pedb');
    const idsB = (lista.json().alunos as { id: string }[]).map((x) => x.id);
    expect(idsB).toContain(ids.c);
    expect(idsB).not.toContain(ids.a);
    expect(idsB).not.toContain(ids.b);
  });

  it('não existe rota com os valores de vários alunos, nem filtro ou ordem por dificuldade', async () => {
    for (const url of ['/apoio/dificuldades', '/apoio/ranking', '/apoio/media', '/apoio/alunos?ordem=dificuldade']) {
      const r = await chamar('GET', url, 'ped');
      expect([200, 404], url).toContain(r.statusCode);
      if (r.statusCode === 200) expect(r.body, url).not.toContain('dificuldade');
    }
  });

  it('a nota alterada pelo aluno aparece só na hora da leitura (sem cópia)', async () => {
    const t = await novaTarefa('b', { titulo: 'Tarefa do B', dificuldade: 2 });
    await chamar('PATCH', `/tarefas/${t.id}`, 'b', { dificuldade: 6 });
    const r = await chamar('GET', `/apoio/alunos/${ids.b}/dificuldades`, 'ped');
    expect(r.json().tarefas.find((x: { titulo: string }) => x.titulo === 'Tarefa do B').dificuldade).toBe(6);
  });
});

describe('cards de resumo', () => {
  const card = (extra: Record<string, unknown> = {}) => ({
    modelo: 'conceito',
    titulo: 'O que é uma fração',
    frente: 'Uma fração é uma parte de um todo.',
    verso: 'Exemplo: 1/2 é metade.',
    ...extra,
  });

  it('cria, lista, edita e desativa um card de tarefa; auditoria sem o conteúdo', async () => {
    const t = await novaTarefa('a', { titulo: 'Tarefa com cards' });
    const novo = await chamar('POST', '/cartoes-resumo', 'a', card({ tarefa_id: t.id }));
    expect(novo.statusCode, novo.body).toBe(201);
    const id = novo.json().cartao.id as string;
    expect(novo.json().cartao.tarefa_titulo).toBe('Tarefa com cards');
    const lista = await chamar('GET', `/cartoes-resumo?tarefa_id=${t.id}`, 'a');
    expect(lista.json().cartoes).toHaveLength(1);
    expect(lista.json().limite).toBe(20);
    const ed = await chamar('PATCH', `/cartoes-resumo/${id}`, 'a', { verso: 'Exemplo: 1/4 é um quarto.' });
    expect(ed.json().cartao.verso).toContain('1/4');
    expect((await chamar('DELETE', `/cartoes-resumo/${id}`, 'a')).statusCode).toBe(204);
    expect((await chamar('GET', `/cartoes-resumo?tarefa_id=${t.id}`, 'a')).json().cartoes).toHaveLength(0);
    // nada se apaga: o card segue no banco, desativado
    const q = await amb.admin.query('SELECT desativado_em FROM cartao_resumo WHERE id = $1', [id]);
    expect(q.rows[0].desativado_em).not.toBeNull();
    const a = await amb.admin.query("SELECT acao, depois FROM auditoria_evento WHERE alvo = $1", [`cartao_resumo:${id}`]);
    expect(a.rows.map((x: { acao: string }) => x.acao)).toEqual(['cartao.criado', 'cartao.editado', 'cartao.desativado']);
    expect(JSON.stringify(a.rows)).not.toContain('fração');
  });

  it('cria card de disciplina; os 4 modelos são aceitos; modelo ou alvo inválido é recusado', async () => {
    const d = await novaDisciplina('a', 'Disciplina de cards');
    for (const modelo of ['conceito', 'passo_a_passo', 'formula', 'pergunta_resposta'])
      expect((await chamar('POST', '/cartoes-resumo', 'a', card({ modelo, disciplina_id: d }))).statusCode, modelo).toBe(201);
    expect((await chamar('POST', '/cartoes-resumo', 'a', card({ modelo: 'livre', disciplina_id: d }))).statusCode).toBe(400);
    expect((await chamar('POST', '/cartoes-resumo', 'a', card())).statusCode).toBe(400);
    const t = await novaTarefa('a');
    expect((await chamar('POST', '/cartoes-resumo', 'a', card({ tarefa_id: t.id, disciplina_id: d }))).statusCode).toBe(400);
    expect((await chamar('POST', '/cartoes-resumo', 'a', card({ extra: 1, disciplina_id: d }))).statusCode).toBe(400);
  });

  it('texto com link, e-mail ou HTML é recusado na API e no banco', async () => {
    const t = await novaTarefa('a');
    for (const ruim of ['veja http://x.com', 'www.x.com', 'a@b.com', '<b>negrito</b>', 'ftp://x']) {
      const r = await chamar('POST', '/cartoes-resumo', 'a', card({ tarefa_id: t.id, frente: ruim }));
      expect(r.statusCode, ruim).toBe(400);
    }
    const r = await chamar('POST', '/cartoes-resumo', 'a', card({ tarefa_id: t.id, titulo: 'veja https://x.com' }));
    expect(r.json().erro).toContain('links');
    // o banco também recusa, mesmo sem passar pela API
    await expect(
      amb.admin.query(
        "INSERT INTO cartao_resumo (instituicao_id, usuario_id, tarefa_id, modelo, titulo, frente, verso) VALUES ($1,$2,$3,'conceito','t','http://x.com','v')",
        [amb.instA, ids.a, t.id],
      ),
    ).rejects.toThrow(/cartao_resumo_frente_check/);
  });

  it('limite de 20 cards por tarefa (API e banco); outra tarefa não é afetada', async () => {
    const t = await novaTarefa('a', { titulo: 'Tarefa lotada' });
    for (let i = 0; i < 20; i++)
      expect((await chamar('POST', '/cartoes-resumo', 'a', card({ tarefa_id: t.id, titulo: `Card ${i}` }))).statusCode).toBe(201);
    const extra = await chamar('POST', '/cartoes-resumo', 'a', card({ tarefa_id: t.id }));
    expect(extra.statusCode).toBe(409);
    await expect(
      amb.admin.query(
        "INSERT INTO cartao_resumo (instituicao_id, usuario_id, tarefa_id, modelo, titulo, frente, verso) VALUES ($1,$2,$3,'conceito','t','f','v')",
        [amb.instA, ids.a, t.id],
      ),
    ).rejects.toThrow(/limite de 20/);
    const outra = await novaTarefa('a', { titulo: 'Outra tarefa' });
    expect((await chamar('POST', '/cartoes-resumo', 'a', card({ tarefa_id: outra.id }))).statusCode).toBe(201);
    // desativar um libera uma vaga
    const lista = await chamar('GET', `/cartoes-resumo?tarefa_id=${t.id}`, 'a');
    await chamar('DELETE', `/cartoes-resumo/${lista.json().cartoes[0].id}`, 'a');
    expect((await chamar('POST', '/cartoes-resumo', 'a', card({ tarefa_id: t.id }))).statusCode).toBe(201);
  });

  it('só o dono vê e mexe: outro aluno, a equipe, professor, Admin e Responsável não', async () => {
    const t = await novaTarefa('a', { titulo: 'Tarefa privada' });
    const novo = await chamar('POST', '/cartoes-resumo', 'a', card({ tarefa_id: t.id }));
    const id = novo.json().cartao.id as string;
    // outro aluno: lista vazia, não acha para editar nem apagar, não cria em tarefa alheia
    expect((await chamar('GET', '/cartoes-resumo', 'b')).json().cartoes).toHaveLength(0);
    expect((await chamar('PATCH', `/cartoes-resumo/${id}`, 'b', { titulo: 'x' })).statusCode).toBe(404);
    expect((await chamar('DELETE', `/cartoes-resumo/${id}`, 'b')).statusCode).toBe(404);
    expect((await chamar('POST', '/cartoes-resumo', 'b', card({ tarefa_id: t.id }))).statusCode).toBe(404);
    expect((await chamar('GET', '/cartoes-resumo', 'c')).json().cartoes).toHaveLength(0);
    for (const quem of ['ped', 'prof', 'adm', 'resp']) {
      expect((await chamar('GET', '/cartoes-resumo', quem)).statusCode, quem).toBe(403);
      expect((await chamar('DELETE', `/cartoes-resumo/${id}`, quem)).statusCode, quem).toBe(403);
    }
    expect((await chamar('GET', '/cartoes-resumo')).statusCode).toBe(401);
  });

  it('módulo "apoio ao aluno" desligado: cards e visão da equipe respondem 403', async () => {
    await amb.admin.query(
      "INSERT INTO instituicao_modulo (instituicao_id, modulo, ligado) VALUES ($1, 'apoio_aluno', false) ON CONFLICT (instituicao_id, modulo) DO UPDATE SET ligado = false",
      [amb.instB],
    );
    expect((await chamar('GET', '/cartoes-resumo', 'c')).statusCode).toBe(403);
    expect((await chamar('GET', '/apoio/alunos', 'pedb')).statusCode).toBe(403);
    // a escola A continua ligada
    expect((await chamar('GET', '/cartoes-resumo', 'a')).statusCode).toBe(200);
  });
});

describe('banco', () => {
  it('dificuldade fora de 0 a 10 é recusada pelo banco', async () => {
    const t = await novaTarefa('a');
    await expect(amb.admin.query('UPDATE tarefa SET dificuldade = 11 WHERE id = $1', [t.id])).rejects.toThrow();
    await expect(amb.admin.query('UPDATE tarefa SET dificuldade = -1 WHERE id = $1', [t.id])).rejects.toThrow();
    await amb.admin.query('UPDATE tarefa SET dificuldade = 10 WHERE id = $1', [t.id]);
  });

  it('card precisa de tarefa OU disciplina, nunca os dois nem nenhum', async () => {
    const t = await novaTarefa('a');
    const d = await novaDisciplina('a', 'Disciplina do banco');
    const sql = (tarefa: string | null, disc: string | null) =>
      amb.admin.query(
        "INSERT INTO cartao_resumo (instituicao_id, usuario_id, tarefa_id, disciplina_aluno_id, modelo, titulo, frente, verso) VALUES ($1,$2,$3,$4,'conceito','t','f','v')",
        [amb.instA, ids.a, tarefa, disc],
      );
    await expect(sql(null, null)).rejects.toThrow();
    await expect(sql(t.id, d)).rejects.toThrow();
    await sql(t.id, null);
  });
});

describe('grade do dia: atividade colocada num horário', () => {
  it('o evento pode ser ligado a uma atividade do próprio aluno; a de outro aluno é recusada', async () => {
    const t = await novaTarefa('a', { titulo: 'Atividade da grade' });
    const dela = await chamar('POST', '/eventos', 'a', {
      titulo: 'Atividade da grade',
      tipo: 'estudo',
      dia: '2026-11-13',
      hora_inicio: '15:00',
      minutos: 25,
      tarefa_id: t.id,
    });
    expect(dela.statusCode, dela.body).toBe(201);
    const id = dela.json().evento.id as string;
    for (let i = 0; i < 100; i++) {
      const q = await amb.admin.query('SELECT tarefa_id FROM evento WHERE id = $1', [id]);
      if (q.rows.length) {
        expect(q.rows[0].tarefa_id).toBe(t.id);
        break;
      }
      await new Promise((ok) => setTimeout(ok, 20));
    }
    const alheia = await chamar('POST', '/eventos', 'b', {
      titulo: 'x',
      tipo: 'estudo',
      dia: '2026-11-13',
      hora_inicio: '16:00',
      tarefa_id: t.id,
    });
    expect(alheia.statusCode).toBe(400);
    const semTarefa = await chamar('POST', '/eventos', 'a', {
      titulo: 'Sem atividade',
      tipo: 'estudo',
      dia: '2026-11-13',
      tarefa_id: null,
    });
    expect(semTarefa.statusCode, semTarefa.body).toBe(201);
  });
});
