import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { hashSenha } from '../auth/senha.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// Disciplinas do aluno (L20b, migração 0019): catálogo, marcar gerais pela etapa, criar/corrigir/desativar,
// limite de 20 próprias (API e banco), isolamento entre alunos, ligação com tarefa e nota. Só dados fictícios.
const SENHA = 'senha de teste longa 123';
let amb: Ambiente;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
const ids: Record<string, string> = {};
const inst: Record<string, string> = {};

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
  const email = `${apelido}-${id.slice(0, 8)}@d.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
    [id, instituicao, perfil, `Pessoa ${apelido}`, email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
    [instituicao, id, await hashSenha(SENHA)],
  );
  ids[apelido] = id;
  inst[apelido] = instituicao;
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { instituicao_id: instituicao, email, senha: SENHA },
  });
  expect(r.statusCode).toBe(200);
  cookies[apelido] = String(r.headers['set-cookie']).split(';')[0] as string;
}

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => new Date('2026-11-10T12:00:00Z'),
    limiteTentativasPorMinuto: 1000,
  });
  await criar(amb.instA, 'aluno', 'a');
  await criar(amb.instA, 'aluno', 'b');
  await criar(amb.instB, 'aluno', 'c');
  await criar(amb.instA, 'professor', 'prof');
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

const nomes = (r: { json: () => { minhas: { nome: string }[] } }) =>
  r.json().minhas.map((d) => d.nome);

describe('acesso e catálogo', () => {
  it('sem sessão 401; professor 403', async () => {
    expect((await chamar('GET', '/minhas-disciplinas')).statusCode).toBe(401);
    expect((await chamar('GET', '/minhas-disciplinas', 'prof')).statusCode).toBe(403);
    expect((await chamar('POST', '/minhas-disciplinas', 'prof', { nome: 'X' })).statusCode).toBe(
      403,
    );
  });

  it('o catálogo traz só o confirmado (D6): BNCC e Informática do IFRN, sem os nomes "[validar]"', async () => {
    const r = await chamar('GET', '/minhas-disciplinas', 'a');
    expect(r.statusCode).toBe(200);
    const cat = r.json().catalogo as { nome: string; sinonimos: string[] }[];
    const n = cat.map((d) => d.nome);
    expect(n).toContain('Língua Portuguesa');
    expect(n).toContain('Programação Estruturada e Orientada a Objetos');
    expect(n).not.toContain('Banco de Dados'); // "[validar]" no Anexo A
    expect(n).not.toContain('Desenho Técnico'); // Eletromecânica: "[validar tudo]"
    expect(cat.find((d) => d.nome === 'Língua Portuguesa')?.sinonimos).toContain('Português');
    expect(r.json().etapa).toBeNull();
    expect(r.json().minhas).toEqual([]);
  });

  it('o aplicativo só lê o catálogo: não escreve', async () => {
    await expect(
      amb.bancoApp.$executeRaw`UPDATE disciplina_catalogo SET nome = 'x' WHERE id = 1`,
    ).rejects.toThrow();
  });
});

describe('etapa e disciplinas gerais', () => {
  it('escolher a etapa marca as gerais; escolher de novo não repete', async () => {
    const r = await chamar('POST', '/minhas-disciplinas/etapa', 'a', { etapa: 'fundamental' });
    expect(r.statusCode, r.body).toBe(200);
    expect(nomes(r)).toEqual(
      [
        'Arte',
        'Ciências',
        'Educação Física',
        'Geografia',
        'História',
        'Língua Inglesa',
        'Língua Portuguesa',
        'Matemática',
      ].sort((x, y) => x.localeCompare(y, 'pt-BR')),
    );
    const de_novo = await chamar('POST', '/minhas-disciplinas/etapa', 'a', {
      etapa: 'fundamental',
    });
    expect(de_novo.json().marcadas).toBe(0);
    expect((await chamar('GET', '/minhas-disciplinas', 'a')).json().etapa).toBe('fundamental');
    expect(
      (await chamar('POST', '/minhas-disciplinas/etapa', 'a', { etapa: 'faculdade' })).statusCode,
    ).toBe(400);
  });

  it('o aluno desmarca uma geral e ela não volta sozinha', async () => {
    const minhas = (await chamar('GET', '/minhas-disciplinas', 'a')).json().minhas as {
      id: string;
      nome: string;
    }[];
    const arte = minhas.find((d) => d.nome === 'Arte');
    expect((await chamar('DELETE', `/minhas-disciplinas/${arte?.id}`, 'a')).statusCode).toBe(204);
    expect(nomes(await chamar('GET', '/minhas-disciplinas', 'a'))).not.toContain('Arte');
  });

  it('as preferências existentes não se perdem ao escolher a etapa', async () => {
    const ok = await chamar('PUT', '/preferencias', 'b', {
      apelido: 'Bê',
      cor_destaque: 'verde',
      tema: 'claro',
      fonte: 110,
      reduzir_movimento: false,
      leitura_facilitada: false,
      modo_simples: false,
      tempo_visual: true,
      linguagem_curta: false,
      escolha_agora: true,
      tela_inicial: 'meudia',
      minutos_curto: 10,
      minutos_medio: 25,
      minutos_longo: 45,
    });
    expect(ok.statusCode, ok.body).toBe(200);
    await chamar('POST', '/minhas-disciplinas/etapa', 'b', { etapa: 'tecnico' });
    const p = (await chamar('GET', '/preferencias', 'b')).json().preferencias;
    expect(p).toMatchObject({ apelido: 'Bê', cor_destaque: 'verde', fonte: 110 });
    // Técnico integrado: gerais do médio (Física, Química, Biologia), sem Ciências
    const n = nomes(await chamar('GET', '/minhas-disciplinas', 'b'));
    expect(n).toContain('Física');
    expect(n).not.toContain('Ciências');
  });
});

describe('disciplinas próprias', () => {
  let id: string;
  it('cria, recusa repetida (sem diferença de acento) e dados inválidos', async () => {
    const r = await chamar('POST', '/minhas-disciplinas', 'c', { nome: 'Teatro Experimental' });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().disciplina).toMatchObject({ origem: 'propria', catalogo_id: null });
    id = r.json().disciplina.id;
    expect(
      (await chamar('POST', '/minhas-disciplinas', 'c', { nome: 'teatro experimental' }))
        .statusCode,
    ).toBe(409);
    expect(
      (await chamar('POST', '/minhas-disciplinas', 'c', { nome: 'Teátro Experimental' }))
        .statusCode,
    ).toBe(409);
    for (const corpo of [
      { nome: '' },
      { nome: 'ver http://x.com' },
      { nome: 'a@b.com' },
      { nome: 'x', extra: 1 },
      {},
    ])
      expect((await chamar('POST', '/minhas-disciplinas', 'c', corpo)).statusCode).toBe(400);
  });

  it('nome igual ao do catálogo vira a do catálogo (não conta no limite) e o catálogo também se marca pelo id', async () => {
    const r = await chamar('POST', '/minhas-disciplinas', 'c', { nome: 'matematica' });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().disciplina).toMatchObject({ nome: 'Matemática', origem: 'catalogo' });
    const k = await chamar('POST', '/minhas-disciplinas', 'c', { catalogo_id: 8 }); // História
    expect(k.json().disciplina).toMatchObject({ nome: 'História', origem: 'catalogo' });
    expect(
      (await chamar('POST', '/minhas-disciplinas', 'c', { catalogo_id: 9999 })).statusCode,
    ).toBe(404);
  });

  it('corrige o nome das próprias; as do catálogo não', async () => {
    const r = await chamar('PATCH', `/minhas-disciplinas/${id}`, 'c', { nome: 'Teatro' });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().disciplina.nome).toBe('Teatro');
    const minhas = (await chamar('GET', '/minhas-disciplinas', 'c')).json().minhas as {
      id: string;
      origem: string;
    }[];
    const doCatalogo = minhas.find((d) => d.origem === 'catalogo');
    expect(
      (await chamar('PATCH', `/minhas-disciplinas/${doCatalogo?.id}`, 'c', { nome: 'Outra' }))
        .statusCode,
    ).toBe(409);
  });

  it('o limite de 20 próprias vale na API e no banco; as do catálogo não contam', async () => {
    for (let i = 1; i < 20; i++)
      expect(
        (await chamar('POST', '/minhas-disciplinas', 'c', { nome: `Própria ${i}` })).statusCode,
        `própria ${i}`,
      ).toBe(201);
    const estouro = await chamar('POST', '/minhas-disciplinas', 'c', { nome: 'Própria 21' });
    expect(estouro.statusCode).toBe(409);
    expect(estouro.json().erro).toContain('20');
    // o banco também recusa, mesmo sem passar pela API
    await expect(
      amb.admin.query(
        "INSERT INTO disciplina_aluno (instituicao_id, usuario_id, nome, origem) VALUES ($1, $2, 'Passou do limite', 'propria')",
        [inst.c, ids.c],
      ),
    ).rejects.toThrow(/limite de 20/);
    // do catálogo ainda cabe
    expect((await chamar('POST', '/minhas-disciplinas', 'c', { catalogo_id: 7 })).statusCode).toBe(
      201,
    );
    // desativar libera uma vaga
    const minhas = (await chamar('GET', '/minhas-disciplinas', 'c')).json().minhas as {
      id: string;
      nome: string;
    }[];
    const p1 = minhas.find((d) => d.nome === 'Própria 1');
    await chamar('DELETE', `/minhas-disciplinas/${p1?.id}`, 'c');
    expect(
      (await chamar('POST', '/minhas-disciplinas', 'c', { nome: 'Própria 21' })).statusCode,
    ).toBe(201);
  });

  it('cada aluno vê só as suas; ninguém altera a de outro; o mesmo nome pode existir para outro aluno', async () => {
    expect(nomes(await chamar('GET', '/minhas-disciplinas', 'b'))).not.toContain('Teatro');
    expect(
      (await chamar('PATCH', `/minhas-disciplinas/${id}`, 'b', { nome: 'Roubada' })).statusCode,
    ).toBe(404);
    expect((await chamar('DELETE', `/minhas-disciplinas/${id}`, 'b')).statusCode).toBe(404);
    expect((await chamar('POST', '/minhas-disciplinas', 'b', { nome: 'Teatro' })).statusCode).toBe(
      201,
    );
    // direto no banco, com a instituição de outro aluno, também não aparece (RLS)
    const q = await amb.admin.query(
      'SELECT count(*)::int AS n FROM disciplina_aluno WHERE usuario_id = $1 AND instituicao_id <> $2',
      [ids.c, inst.c],
    );
    expect(q.rows[0].n).toBe(0);
  });
});

describe('tarefa e nota pessoal com disciplina da lista', () => {
  let discId: string;
  let tarefaId: string;
  it('a tarefa guarda o nome e a ligação; disciplina de outro aluno é recusada', async () => {
    const d = await chamar('POST', '/minhas-disciplinas', 'b', { nome: 'Robótica' });
    discId = d.json().disciplina.id;
    const t = await chamar('POST', '/tarefas', 'b', {
      titulo: 'Montar o robô',
      disciplina_id: discId,
    });
    expect(t.statusCode, t.body).toBe(201);
    expect(t.json().tarefa).toMatchObject({ disciplina: 'Robótica', disciplina_aluno_id: discId });
    tarefaId = t.json().tarefa.id;
    const outro = await chamar('POST', '/tarefas', 'a', {
      titulo: 'Roubar',
      disciplina_id: discId,
    });
    expect(outro.statusCode).toBe(400);
    const inexistente = await chamar('POST', '/tarefas', 'b', {
      titulo: 'x',
      disciplina_id: randomUUID(),
    });
    expect(inexistente.statusCode).toBe(400);
  });

  it('texto livre continua aceito e liga quando o nome existe', async () => {
    const t = await chamar('POST', '/tarefas', 'b', { titulo: 'Ler', disciplina: 'robotica' });
    expect(t.json().tarefa).toMatchObject({ disciplina: 'robotica', disciplina_aluno_id: discId });
    const livre = await chamar('POST', '/tarefas', 'b', {
      titulo: 'Ler 2',
      disciplina: 'Sem lista',
    });
    expect(livre.json().tarefa).toMatchObject({
      disciplina: 'Sem lista',
      disciplina_aluno_id: null,
    });
  });

  it('trocar e limpar a disciplina da tarefa; sem mexer, ela fica como estava', async () => {
    const mat = (await chamar('POST', '/minhas-disciplinas', 'b', { nome: 'Matemática' })).json();
    const catId =
      mat.disciplina?.id ??
      (
        (await chamar('GET', '/minhas-disciplinas', 'b')).json().minhas as {
          id: string;
          nome: string;
        }[]
      ).find((d) => d.nome === 'Matemática')?.id;
    const r = await chamar('PATCH', `/tarefas/${tarefaId}`, 'b', { disciplina_id: catId });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().tarefa).toMatchObject({ disciplina: 'Matemática' });
    const so_titulo = await chamar('PATCH', `/tarefas/${tarefaId}`, 'b', { titulo: 'Novo título' });
    expect(so_titulo.json().tarefa).toMatchObject({
      disciplina: 'Matemática',
      titulo: 'Novo título',
    });
    const limpa = await chamar('PATCH', `/tarefas/${tarefaId}`, 'b', { disciplina_id: null });
    expect(limpa.json().tarefa).toMatchObject({ disciplina: '', disciplina_aluno_id: null });
  });

  it('a nota pessoal usa a disciplina da lista; a média agrupa pelo nome', async () => {
    for (const valor of [6, 8]) {
      const r = await chamar('POST', '/notas-pessoais', 'b', {
        disciplina_id: discId,
        valor,
        dia: '2026-11-10',
      });
      expect(r.statusCode, r.body).toBe(201);
    }
    const lista = (await chamar('GET', '/notas-pessoais', 'b')).json();
    expect(lista.medias).toEqual([{ disciplina: 'Robótica', media: 7, quantidade: 2 }]);
    expect(
      (
        await chamar('POST', '/notas-pessoais', 'a', {
          disciplina_id: discId,
          valor: 5,
          dia: '2026-11-10',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await chamar('POST', '/notas-pessoais', 'b', { valor: 5, dia: '2026-11-10' })).statusCode,
    ).toBe(400);
    // texto livre continua valendo
    expect(
      (
        await chamar('POST', '/notas-pessoais', 'b', {
          disciplina: 'Outra coisa',
          valor: 5,
          dia: '2026-11-10',
        })
      ).statusCode,
    ).toBe(201);
  });

  it('corrigir o nome atualiza as tarefas e notas ligadas; desativar não muda o que já foi escrito', async () => {
    const r = await chamar('PATCH', `/minhas-disciplinas/${discId}`, 'b', {
      nome: 'Robótica Educacional',
    });
    expect(r.statusCode, r.body).toBe(200);
    const tarefas = (await chamar('GET', '/tarefas', 'b')).json().tarefas as {
      disciplina: string;
      disciplina_aluno_id: string | null;
    }[];
    expect(
      tarefas
        .filter((t) => t.disciplina_aluno_id === discId)
        .every((t) => t.disciplina === 'Robótica Educacional'),
    ).toBe(true);
    await chamar('DELETE', `/minhas-disciplinas/${discId}`, 'b');
    const depois = (await chamar('GET', '/tarefas', 'b')).json().tarefas as {
      disciplina: string;
    }[];
    expect(depois.some((t) => t.disciplina === 'Robótica Educacional')).toBe(true);
    // disciplina desativada não pode mais ser escolhida
    expect(
      (await chamar('POST', '/tarefas', 'b', { titulo: 'y', disciplina_id: discId })).statusCode,
    ).toBe(400);
  });
});

describe('disciplinas da escola', () => {
  it('traz as disciplinas das turmas do aluno (origem escola) sem repetir', async () => {
    const turma = randomUUID();
    const disc = randomUUID();
    const prof = ids.prof as string;
    await amb.admin.query(
      "INSERT INTO turma (instituicao_id, id, nome, ano_letivo, turno) VALUES ($1,$2,'1º A',2026,'manha')",
      [amb.instA, turma],
    );
    await amb.admin.query(
      "INSERT INTO disciplina (instituicao_id, id, nome) VALUES ($1,$2,'Educação Ambiental')",
      [amb.instA, disc],
    );
    await amb.admin.query(
      "INSERT INTO vinculo (instituicao_id, tipo, usuario_id, turma_id) VALUES ($1,'aluno_turma',$2,$3)",
      [amb.instA, ids.a, turma],
    );
    await amb.admin.query(
      "INSERT INTO vinculo (instituicao_id, tipo, usuario_id, turma_id, disciplina_id) VALUES ($1,'professor_turma',$2,$3,$4)",
      [amb.instA, prof, turma, disc],
    );
    const r = await chamar('POST', '/minhas-disciplinas/da-escola', 'a');
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().novas).toBe(1);
    expect(
      (r.json().minhas as { nome: string; origem: string }[]).find(
        (d) => d.nome === 'Educação Ambiental',
      )?.origem,
    ).toBe('escola');
    expect((await chamar('POST', '/minhas-disciplinas/da-escola', 'a')).json().novas).toBe(0);
    // quem não tem turma não recebe nada
    expect((await chamar('POST', '/minhas-disciplinas/da-escola', 'c')).json().novas).toBe(0);
  });
});
