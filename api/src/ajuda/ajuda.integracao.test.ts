import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { verificarCadeia } from '../auditoria/auditoria.js';
import { hashSenha } from '../auth/senha.js';
import { withTenant } from '../banco/withTenant.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import { MAXIMO_ABERTOS } from './rotas.js';

// Pedido de ajuda (L17, item 3): o aluno pede ao professor de uma turma dele ou à equipe pedagógica (NAPNE).
// Isolamento entre instituições (A x B), entre turmas e entre alunos; perfil sem permissão negado e auditado;
// "visto" no sino; gatilhos do banco (0010). Só dados fictícios.
const SENHA = 'senha de teste longa 123';
let amb: Ambiente;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
const ids: Record<string, string> = {};

const chamar = (metodo: 'GET' | 'POST', url: string, quem: string, payload?: unknown) =>
  app.inject({
    method: metodo,
    url,
    payload: payload as object,
    headers: { cookie: cookies[quem] as string },
  });
type Item = { tipo: string; id: string; visto: boolean; [campo: string]: unknown };
const caixa = async (quem: string) => {
  const r = await chamar('GET', '/caixa', quem);
  expect(r.statusCode, quem).toBe(200);
  return r.json() as { itens: Item[]; nao_vistos: number };
};
const ajudasNaCaixa = async (quem: string) =>
  (await caixa(quem)).itens.filter((i) => i.tipo.startsWith('ajuda'));
const auditorias = async (acao: string) =>
  (await amb.admin.query('SELECT count(*)::int AS n FROM auditoria_evento WHERE acao = $1', [acao]))
    .rows[0].n as number;

async function criarPessoa(inst: string, perfil: string, apelido: string) {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@t.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
    [id, inst, perfil, `Pessoa ${apelido}`, email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
    [inst, id, await hashSenha(SENHA)],
  );
  ids[apelido] = id;
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { instituicao_id: inst, email, senha: SENHA },
  });
  expect(r.statusCode).toBe(200);
  cookies[apelido] = String(r.headers['set-cookie']).split(';')[0] as string;
}

const vincular = (inst: string, tipo: string, usuario: string, turma?: string, disc?: string) =>
  amb.admin.query(
    'INSERT INTO vinculo (instituicao_id, tipo, usuario_id, turma_id, disciplina_id) VALUES ($1,$2,$3,$4,$5)',
    [inst, tipo, usuario, turma ?? null, disc ?? null],
  );

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    limiteTentativasPorMinuto: 1000,
  });
  const A = amb.instA;
  const B = amb.instB;
  for (const [perfil, apelido] of [
    ['professor', 'profA'], // turma A
    ['professor', 'profD'], // turma A2
    ['aluno', 'alunoA'],
    ['aluno', 'alunoA2'],
    ['aluno', 'alunoLimite'],
    ['responsavel', 'respA'],
    ['pedagogico', 'pedA'],
    ['pedagogico', 'pedA2'],
  ] as const)
    await criarPessoa(A, perfil, apelido);
  for (const [perfil, apelido] of [
    ['professor', 'profB'],
    ['aluno', 'alunoB'],
    ['pedagogico', 'pedB'],
  ] as const)
    await criarPessoa(B, perfil, apelido);

  const nova = async (sql: string, p: unknown[]) =>
    (await amb.admin.query(sql, p)).rows[0].id as string;
  const turma = (inst: string, nome: string) =>
    nova(
      "INSERT INTO turma (instituicao_id, nome, ano_letivo, turno) VALUES ($1,$2,2026,'manha') RETURNING id",
      [inst, nome],
    );
  ids.turmaA = await turma(A, '7º A');
  ids.turmaA2 = await turma(A, '7º B');
  ids.discA = await nova(
    "INSERT INTO disciplina (instituicao_id, nome) VALUES ($1,'Matemática') RETURNING id",
    [A],
  );
  ids.turmaB = await turma(B, '7º A');
  ids.discB = await nova(
    "INSERT INTO disciplina (instituicao_id, nome) VALUES ($1,'Matemática') RETURNING id",
    [B],
  );
  await vincular(A, 'professor_turma', ids.profA as string, ids.turmaA, ids.discA);
  await vincular(A, 'professor_turma', ids.profD as string, ids.turmaA2, ids.discA);
  await vincular(A, 'aluno_turma', ids.alunoA as string, ids.turmaA);
  await vincular(A, 'aluno_turma', ids.alunoA2 as string, ids.turmaA2);
  await vincular(A, 'aluno_turma', ids.alunoLimite as string, ids.turmaA);
  await vincular(B, 'professor_turma', ids.profB as string, ids.turmaB, ids.discB);
  await vincular(B, 'aluno_turma', ids.alunoB as string, ids.turmaB);

  // Atividades com etapas (do próprio aluno)
  const criarTarefa = async (quem: string) => {
    const r = await chamar('POST', '/tarefas', quem, {
      titulo: 'Exercícios de frações',
      microetapas: ['Ler o enunciado', 'Fazer a questão 1'],
    });
    expect(r.statusCode).toBe(201);
    return r.json().tarefa as { id: string; microetapas: { id: string }[] };
  };
  const tA = await criarTarefa('alunoA');
  ids.tarefaA = tA.id;
  ids.etapaA = tA.microetapas[0]?.id as string;
  ids.tarefaA2 = (await criarTarefa('alunoA2')).id;
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

const aoProfessorA = (extra: object = {}) => ({
  destino: 'professor',
  professor_id: ids.profA,
  turma_id: ids.turmaA,
  disciplina_id: ids.discA,
  motivo: 'nao_entendi',
  ...extra,
});

describe('destinos: o aluno vê só os professores das turmas dele e a equipe pedagógica', () => {
  it('lista o professor da turma do aluno, com disciplina, e não o de outra turma', async () => {
    const r = await chamar('GET', '/ajuda/destinos', 'alunoA');
    expect(r.statusCode).toBe(200);
    const d = r.json() as { professores: { professor_id: string }[]; equipe_pedagogica: boolean };
    expect(d.professores.map((p) => p.professor_id)).toEqual([ids.profA]);
    expect(d.equipe_pedagogica).toBe(true);
  });

  it('outros perfis não usam: negado e auditado', async () => {
    for (const quem of ['profA', 'respA', 'pedA']) {
      expect((await chamar('GET', '/ajuda/destinos', quem)).statusCode, quem).toBe(403);
      expect((await chamar('POST', '/ajuda', quem, aoProfessorA())).statusCode, quem).toBe(403);
    }
    expect(await auditorias('ajuda.acesso_negado')).toBeGreaterThanOrEqual(6);
  });
});

describe('pedir ajuda', () => {
  it('ao professor da turma, ligado à atividade e à etapa: criado e auditado', async () => {
    const r = await chamar(
      'POST',
      '/ajuda',
      'alunoA',
      aoProfessorA({
        tarefa_id: ids.tarefaA,
        microetapa_id: ids.etapaA,
        texto: 'Não sei o que é denominador.',
      }),
    );
    expect(r.statusCode).toBe(201);
    ids.ajudaProf = r.json().id;
    expect(await auditorias('ajuda.pedida')).toBe(1);
  });

  it('à equipe pedagógica, sem atividade: criado', async () => {
    const r = await chamar('POST', '/ajuda', 'alunoA', {
      destino: 'pedagogico',
      motivo: 'nao_sei_comecar',
    });
    expect(r.statusCode).toBe(201);
    ids.ajudaPed = r.json().id;
  });

  it('professor de outra turma, de outra escola, ou disciplina trocada: 404', async () => {
    for (const corpo of [
      aoProfessorA({ professor_id: ids.profD }),
      aoProfessorA({ turma_id: ids.turmaA2 }),
      aoProfessorA({ professor_id: ids.profB, turma_id: ids.turmaB, disciplina_id: ids.discB }),
      aoProfessorA({ disciplina_id: ids.discB }),
    ])
      expect((await chamar('POST', '/ajuda', 'alunoA', corpo)).statusCode).toBe(404);
  });

  it('atividade ou etapa de outro aluno: 404', async () => {
    expect(
      (await chamar('POST', '/ajuda', 'alunoA', aoProfessorA({ tarefa_id: ids.tarefaA2 })))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await chamar('POST', '/ajuda', 'alunoA2', {
          destino: 'pedagogico',
          motivo: 'outro',
          tarefa_id: ids.tarefaA2,
          microetapa_id: ids.etapaA,
        })
      ).statusCode,
    ).toBe(404);
  });

  it('texto com link, motivo desconhecido ou campo a mais: 400', async () => {
    const link = await chamar(
      'POST',
      '/ajuda',
      'alunoA',
      aoProfessorA({ texto: 'veja www.x.com' }),
    );
    expect(link.statusCode).toBe(400);
    expect(link.json().erro).toBe('O texto não pode ter links.');
    expect(
      (await chamar('POST', '/ajuda', 'alunoA', aoProfessorA({ motivo: 'urgente' }))).statusCode,
    ).toBe(400);
    expect(
      (await chamar('POST', '/ajuda', 'alunoA', aoProfessorA({ aluno_id: ids.alunoA2 })))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await chamar('POST', '/ajuda', 'alunoA', {
          destino: 'pedagogico',
          motivo: 'outro',
          professor_id: ids.profA,
        })
      ).statusCode,
    ).toBe(400);
  });

  it(`no máximo ${MAXIMO_ABERTOS} pedidos esperando resposta por aluno`, async () => {
    for (let i = 0; i < MAXIMO_ABERTOS; i++)
      expect((await chamar('POST', '/ajuda', 'alunoLimite', aoProfessorA())).statusCode).toBe(201);
    const r = await chamar('POST', '/ajuda', 'alunoLimite', aoProfessorA());
    expect(r.statusCode).toBe(409);
  });
});

describe('sino Mensagens: cada um vê só o que é seu', () => {
  it('professor da turma vê o pedido feito a ele; outro professor e Pedagógico não', async () => {
    const prof = await ajudasNaCaixa('profA');
    const meu = prof.find((i) => i.id === ids.ajudaProf);
    expect(meu?.tipo).toBe('ajuda_aberta');
    expect(meu?.visto).toBe(false);
    expect(meu?.tarefa_titulo).toBe('Exercícios de frações');
    expect(meu?.etapa_texto).toBe('Ler o enunciado');
    expect(prof.some((i) => i.id === ids.ajudaPed)).toBe(false);
    expect(await ajudasNaCaixa('profD')).toEqual([]);
    expect((await ajudasNaCaixa('pedA')).some((i) => i.id === ids.ajudaProf)).toBe(false);
  });

  it('Pedagógico (NAPNE) da escola vê o pedido à equipe; o de outra escola, não', async () => {
    for (const quem of ['pedA', 'pedA2'])
      expect(
        (await ajudasNaCaixa(quem)).map((i) => i.id),
        quem,
      ).toEqual([ids.ajudaPed]);
    expect(await ajudasNaCaixa('pedB')).toEqual([]);
  });

  it('responsável e outro aluno não veem; o aluno vê os próprios, esperando resposta, sem contar', async () => {
    expect(await ajudasNaCaixa('respA')).toEqual([]);
    expect(await ajudasNaCaixa('alunoA2')).toEqual([]);
    const meus = await ajudasNaCaixa('alunoA');
    expect(meus.map((i) => i.id).sort()).toEqual([ids.ajudaProf, ids.ajudaPed].sort());
    expect(meus.every((i) => i.tipo === 'ajuda_minha' && i.estado === 'aberto' && i.visto)).toBe(
      true,
    );
  });

  it('abrir a caixa marca como visto', async () => {
    expect((await chamar('POST', '/caixa/vistos', 'profA')).statusCode).toBe(200);
    expect((await caixa('profA')).itens.find((i) => i.id === ids.ajudaProf)?.visto).toBe(true);
  });
});

describe('atender', () => {
  it('outro professor e o Pedagógico não atendem o pedido feito ao professor: 404', async () => {
    for (const quem of ['profD', 'pedA', 'profB'])
      expect(
        (await chamar('POST', `/ajuda/${ids.ajudaProf}/atender`, quem, {})).statusCode,
        quem,
      ).toBe(404);
    expect((await chamar('POST', `/ajuda/${ids.ajudaProf}/atender`, 'alunoA', {})).statusCode).toBe(
      403,
    );
  });

  it('o professor atende com resposta; a segunda vez é recusada', async () => {
    const r = await chamar('POST', `/ajuda/${ids.ajudaProf}/atender`, 'profA', {
      resposta: 'Vamos ver juntos na aula de amanhã.',
    });
    expect(r.statusCode).toBe(204);
    expect((await chamar('POST', `/ajuda/${ids.ajudaProf}/atender`, 'profA', {})).statusCode).toBe(
      409,
    );
    expect((await ajudasNaCaixa('profA')).some((i) => i.id === ids.ajudaProf)).toBe(false);
    expect(await auditorias('ajuda.atendida')).toBe(1);
  });

  it('o aluno recebe a resposta como não vista; abrir a caixa zera a contagem', async () => {
    const c = await caixa('alunoA');
    const item = c.itens.find((i) => i.id === ids.ajudaProf);
    expect(item).toMatchObject({
      estado: 'atendido',
      resposta: 'Vamos ver juntos na aula de amanhã.',
      visto: false,
    });
    expect(item?.atendido_por_nome).toBe('Pessoa profA');
    expect(c.nao_vistos).toBeGreaterThanOrEqual(1);
    await chamar('POST', '/caixa/vistos', 'alunoA');
    expect((await caixa('alunoA')).nao_vistos).toBe(0);
  });

  it('professor não atende pedido da equipe; Pedagógico atende sem resposta escrita', async () => {
    expect((await chamar('POST', `/ajuda/${ids.ajudaPed}/atender`, 'profA', {})).statusCode).toBe(
      404,
    );
    expect((await chamar('POST', `/ajuda/${ids.ajudaPed}/atender`, 'pedB', {})).statusCode).toBe(
      404,
    );
    expect((await chamar('POST', `/ajuda/${ids.ajudaPed}/atender`, 'pedA', {})).statusCode).toBe(
      204,
    );
    expect(await ajudasNaCaixa('pedA2')).toEqual([]);
  });

  it('resposta com link: 400', async () => {
    const [id] = (
      await amb.admin.query("SELECT id FROM pedido_ajuda WHERE estado = 'aberto' LIMIT 1")
    ).rows.map((l) => l.id as string);
    const r = await chamar('POST', `/ajuda/${id}/atender`, 'profA', { resposta: 'https://x.com' });
    expect(r.statusCode).toBe(400);
  });
});

describe('banco: RLS, append-only e gatilhos (0010)', () => {
  it('sem contexto nada aparece; com o contexto de A, nada de B', async () => {
    expect(await amb.bancoApp.$queryRawUnsafe<unknown[]>('SELECT * FROM pedido_ajuda')).toEqual([]);
    const deA = await withTenant(amb.bancoApp, { instituicaoId: amb.instA }, (tx) =>
      tx.$queryRawUnsafe<{ instituicao_id: string }[]>('SELECT instituicao_id FROM pedido_ajuda'),
    );
    expect(deA.length).toBeGreaterThan(0);
    expect(deA.every((l) => l.instituicao_id === amb.instA)).toBe(true);
  });

  it('não aceita DELETE, nem mudar o que o aluno escreveu, nem reabrir', async () => {
    for (const sql of [
      'DELETE FROM pedido_ajuda',
      "UPDATE pedido_ajuda SET texto = 'outro'",
      "UPDATE pedido_ajuda SET estado = 'aberto', atendido_por = NULL, atendido_em = NULL, resposta = ''",
    ]) {
      await expect(
        withTenant(amb.bancoApp, { instituicaoId: amb.instA }, (tx) => tx.$executeRawUnsafe(sql)),
        sql,
      ).rejects.toThrow();
    }
  });

  it('o banco confere o perfil de quem pede e do professor, mesmo se a API fosse contornada', async () => {
    const tentar = (aluno: string, professor: string) =>
      amb.admin.query(
        "INSERT INTO pedido_ajuda (instituicao_id, aluno_id, destino, professor_id, turma_id, disciplina_id, motivo) VALUES ($1,$2,'professor',$3,$4,$5,'outro')",
        [amb.instA, aluno, professor, ids.turmaA, ids.discA],
      );
    await expect(tentar(ids.respA as string, ids.profA as string)).rejects.toThrow(/aluno/);
    await expect(tentar(ids.alunoA as string, ids.pedA as string)).rejects.toThrow(/professor/);
    await expect(
      amb.admin.query(
        "INSERT INTO pedido_ajuda (instituicao_id, aluno_id, destino, professor_id, motivo) VALUES ($1,$2,'pedagogico',$3,'outro')",
        [amb.instA, ids.alunoA, ids.profA],
      ),
    ).rejects.toThrow();
  });

  it('o visto continua exigindo exatamente um item', async () => {
    const p = (await amb.admin.query('SELECT id FROM pedido_ajuda LIMIT 1')).rows[0].id;
    const pedidoRevisao = randomUUID();
    await expect(
      amb.admin.query(
        'INSERT INTO aviso_visto (instituicao_id, usuario_id, ajuda_id, pedido_id) VALUES ($1,$2,$3,$4)',
        [amb.instA, ids.alunoA, p, pedidoRevisao],
      ),
    ).rejects.toThrow();
  });

  it('a auditoria registra pedir e atender, e a cadeia está íntegra', async () => {
    for (const inst of [amb.instA, amb.instB]) {
      expect(
        await withTenant(amb.bancoApp, { instituicaoId: inst }, (tx) => verificarCadeia(tx)),
      ).toEqual([]);
    }
  });
});
