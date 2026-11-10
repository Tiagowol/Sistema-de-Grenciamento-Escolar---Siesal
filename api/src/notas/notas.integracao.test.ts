import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { verificarCadeia } from '../auditoria/auditoria.js';
import { hashSenha } from '../auth/senha.js';
import { base32Decodificar, codigoTotp, passoDe } from '../auth/totp.js';
import { withTenant } from '../banco/withTenant.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// Notas oficiais e pedidos de revisão (L15): permissões da matriz v4, vínculos, isolamento entre
// instituições (A x B) e entre turmas, auditoria e ausência de ranking. Só dados fictícios.
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
  let cookie = String(r.headers['set-cookie']).split(';')[0] as string;
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
      payload: { codigo: codigoTotp(base32Decodificar(ini.json().segredo), passoDe(new Date())) },
      headers: { cookie },
    });
    expect(ok.statusCode).toBe(200);
    cookie = String(ok.headers['set-cookie']).split(';')[0] as string;
  }
  cookies[apelido] = cookie;
}

// Vínculo direto no banco (o cadastro pela tela é testado no L14)
const vincular = (
  inst: string,
  tipo: string,
  usuario: string,
  turma?: string,
  disc?: string,
  aluno?: string,
) =>
  amb.admin.query(
    'INSERT INTO vinculo (instituicao_id, tipo, usuario_id, turma_id, disciplina_id, aluno_id) VALUES ($1,$2,$3,$4,$5,$6)',
    [inst, tipo, usuario, turma ?? null, disc ?? null, aluno ?? null],
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
    ['admin', 'adminA'],
    ['professor', 'profA'],
    ['professor', 'profC'], // mesma turma e disciplina, mas não lançou a nota
    ['professor', 'profSem'], // sem vínculo
    ['aluno', 'alunoA'],
    ['aluno', 'alunoA2'],
    ['responsavel', 'respA'],
    ['responsavel', 'respA2'],
    ['pedagogico', 'pedA'],
  ] as const)
    await criarPessoa(A, perfil, apelido);
  for (const [perfil, apelido] of [
    ['admin', 'adminB'],
    ['professor', 'profB'],
    ['aluno', 'alunoB'],
  ] as const)
    await criarPessoa(B, perfil, apelido);

  const nova = async (sql: string, p: unknown[]) =>
    (await amb.admin.query(sql, p)).rows[0].id as string;
  ids.turmaA = await nova(
    "INSERT INTO turma (instituicao_id, nome, ano_letivo, turno) VALUES ($1,'7º A',2026,'manha') RETURNING id",
    [A],
  );
  ids.turmaA2 = await nova(
    "INSERT INTO turma (instituicao_id, nome, ano_letivo, turno) VALUES ($1,'7º B',2026,'tarde') RETURNING id",
    [A],
  );
  ids.discA = await nova(
    "INSERT INTO disciplina (instituicao_id, nome) VALUES ($1,'Matemática') RETURNING id",
    [A],
  );
  ids.turmaB = await nova(
    "INSERT INTO turma (instituicao_id, nome, ano_letivo, turno) VALUES ($1,'7º A',2026,'manha') RETURNING id",
    [B],
  );
  ids.discB = await nova(
    "INSERT INTO disciplina (instituicao_id, nome) VALUES ($1,'Matemática') RETURNING id",
    [B],
  );
  await vincular(A, 'professor_turma', ids.profA as string, ids.turmaA, ids.discA);
  await vincular(A, 'professor_turma', ids.profC as string, ids.turmaA, ids.discA);
  await vincular(A, 'aluno_turma', ids.alunoA as string, ids.turmaA);
  await vincular(A, 'aluno_turma', ids.alunoA2 as string, ids.turmaA);
  await vincular(A, 'responsavel_aluno', ids.respA as string, undefined, undefined, ids.alunoA);
  await vincular(A, 'responsavel_aluno', ids.respA2 as string, undefined, undefined, ids.alunoA2);
  await vincular(B, 'professor_turma', ids.profB as string, ids.turmaB, ids.discB);
  await vincular(B, 'aluno_turma', ids.alunoB as string, ids.turmaB);
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

const lancar = (quem: string, aluno: string, turma: string, disc: string, valor = 7.5) =>
  chamar('POST', '/notas-oficiais', quem, {
    aluno_id: ids[aluno],
    turma_id: ids[turma],
    disciplina_id: ids[disc],
    descricao: 'Prova 1',
    valor,
    dia: '2026-11-05',
  });

describe('professor lança nota (matriz v4)', () => {
  it('perfil sem permissão é negado em todas as rotas de escrita, com auditoria', async () => {
    for (const quem of ['adminA', 'alunoA', 'respA', 'pedA']) {
      expect((await lancar(quem, 'alunoA', 'turmaA', 'discA')).statusCode, quem).toBe(403);
      expect(
        (
          await chamar('POST', `/notas-oficiais/${randomUUID()}/revisoes`, quem, {
            valor: 5,
            motivo: 'x',
          })
        ).statusCode,
        quem,
      ).toBe(403);
      expect((await chamar('GET', '/professor/turmas', quem)).statusCode, quem).toBe(403);
      const negados = await amb.admin.query(
        "SELECT count(*)::int AS n FROM auditoria_evento WHERE acao = 'notas.acesso_negado' AND ator = $1",
        [`usuario:${ids[quem]}`],
      );
      expect(negados.rows[0].n, quem).toBeGreaterThan(0);
    }
    expect((await app.inject({ method: 'GET', url: '/notas-oficiais' })).statusCode).toBe(401);
  });

  it('professor sem vínculo com a turma e disciplina é negado; vínculo de outra instituição não vale', async () => {
    expect((await lancar('profSem', 'alunoA', 'turmaA', 'discA')).statusCode).toBe(403);
    expect((await lancar('profB', 'alunoA', 'turmaA', 'discA')).statusCode).toBe(403);
    expect((await lancar('profA', 'alunoA', 'turmaA2', 'discA')).statusCode).toBe(403);
    const negados = await amb.admin.query(
      "SELECT count(*)::int AS n FROM auditoria_evento WHERE acao = 'nota.lancamento_negado'",
    );
    expect(negados.rows[0].n).toBeGreaterThanOrEqual(3);
  });

  it('lista só as turmas e disciplinas dele, com os alunos', async () => {
    const lista = (await chamar('GET', '/professor/turmas', 'profA')).json().turmas;
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ turma_nome: '7º A', disciplina_nome: 'Matemática' });
    expect(lista[0].alunos).toHaveLength(2);
    expect((await chamar('GET', '/professor/turmas', 'profSem')).json().turmas).toEqual([]);
  });

  it('lança nota válida, recusa aluno de outra turma, valor fora de 0 a 10 e campos extras', async () => {
    const ok = await lancar('profA', 'alunoA', 'turmaA', 'discA');
    expect(ok.statusCode).toBe(201);
    ids.nota1 = ok.json().id;
    expect((await lancar('profA', 'alunoB', 'turmaA', 'discA')).statusCode).toBe(400);
    expect((await lancar('profA', 'alunoA', 'turmaA', 'discA', 10.5)).statusCode).toBe(400);
    expect((await lancar('profA', 'alunoA', 'turmaA', 'discA', -1)).statusCode).toBe(400);
    const extra = await chamar('POST', '/notas-oficiais', 'profA', {
      aluno_id: ids.alunoA,
      turma_id: ids.turmaA,
      disciplina_id: ids.discA,
      valor: 5,
      dia: '2026-11-05',
      professor_id: ids.profC,
    });
    expect(extra.statusCode).toBe(400);
    ids.nota2 = (await lancar('profA', 'alunoA2', 'turmaA', 'discA', 4)).json().id;
  });
});

describe('leitura por perfil (sem ranking nem comparação)', () => {
  const ver = async (quem: string) => (await chamar('GET', '/notas-oficiais', quem)).json().notas;

  it('aluno vê só as próprias notas; responsável só as do aluno vinculado', async () => {
    expect((await ver('alunoA')).map((n: { id: string }) => n.id)).toEqual([ids.nota1]);
    expect((await ver('alunoA2')).map((n: { id: string }) => n.id)).toEqual([ids.nota2]);
    expect((await ver('respA')).map((n: { id: string }) => n.id)).toEqual([ids.nota1]);
    expect((await ver('respA2')).map((n: { id: string }) => n.id)).toEqual([ids.nota2]);
  });

  it('professor vê só as suas turmas e disciplinas; sem vínculo, nada', async () => {
    expect((await ver('profA')).length).toBe(2);
    expect(await ver('profSem')).toEqual([]);
    expect(await ver('profB')).toEqual([]);
  });

  it('Pedagógico lê a nota atual sem histórico; Admin e professor veem o histórico', async () => {
    const ped = await ver('pedA');
    expect(ped.length).toBe(2);
    expect(ped[0]).not.toHaveProperty('versoes');
    expect((await ver('adminA'))[0]).toHaveProperty('versoes');
    expect((await ver('profA'))[0]).toHaveProperty('versoes');
    expect((await ver('alunoA'))[0]).not.toHaveProperty('versoes');
  });

  it('isolamento entre instituições: A não vê B e B não vê A', async () => {
    const b = await lancar('profB', 'alunoB', 'turmaB', 'discB', 9);
    expect(b.statusCode).toBe(201);
    ids.notaB = b.json().id;
    for (const quem of ['adminA', 'pedA', 'profA', 'alunoA'])
      expect((await ver(quem)).map((n: { id: string }) => n.id)).not.toContain(ids.notaB);
    for (const quem of ['adminB', 'profB', 'alunoB'])
      expect((await ver(quem)).map((n: { id: string }) => n.id)).toEqual([ids.notaB]);
  });

  it('nenhuma resposta traz ranking, média da turma ou posição', async () => {
    for (const quem of ['alunoA', 'respA', 'profA', 'adminA', 'pedA']) {
      const texto = (await chamar('GET', '/notas-oficiais', quem)).body;
      expect(texto, quem).not.toMatch(/ranking|posicao|posição|classifica|media|média/i);
    }
  });
});

describe('pedido de revisão', () => {
  const pedir = (quem: string, nota: string, texto = 'Gostaria que a nota fosse olhada de novo.') =>
    chamar('POST', `/notas-oficiais/${ids[nota]}/pedidos`, quem, { texto });

  it('aluno só pede sobre a própria nota; responsável só sobre a do aluno vinculado', async () => {
    expect((await pedir('alunoA2', 'nota1')).statusCode).toBe(404);
    expect((await pedir('respA2', 'nota1')).statusCode).toBe(404);
    expect((await pedir('alunoB', 'nota1')).statusCode).toBe(404);
    expect((await pedir('adminB', 'nota1')).statusCode).toBe(404);
    expect((await pedir('adminA', 'notaB')).statusCode).toBe(404);
    const r = await pedir('alunoA', 'nota1');
    expect(r.statusCode).toBe(201);
    ids.pedidoAluno = r.json().id;
    expect((await pedir('respA', 'nota1')).statusCode).toBe(201);
  });

  it('professor não pede; Admin e Pedagógico pedem sobre notas da própria instituição', async () => {
    expect((await pedir('profA', 'nota1')).statusCode).toBe(403);
    const a = await pedir('adminA', 'nota1');
    expect(a.statusCode).toBe(201);
    ids.pedidoAdmin = a.json().id;
    const p = await pedir('pedA', 'nota1');
    expect(p.statusCode).toBe(201);
    ids.pedidoPed = p.json().id;
    const salvo = await amb.admin.query('SELECT perfil_pedinte FROM pedido_revisao WHERE id = $1', [
      ids.pedidoPed,
    ]);
    expect(salvo.rows[0].perfil_pedinte).toBe('pedagogico');
  });

  it('recusa pedido repetido, texto vazio, longo, com link ou campo extra', async () => {
    expect((await pedir('alunoA', 'nota1')).statusCode).toBe(409);
    expect((await pedir('alunoA2', 'nota2', '   ')).statusCode).toBe(400);
    expect((await pedir('alunoA2', 'nota2', 'a'.repeat(301))).statusCode).toBe(400);
    const link = await pedir('alunoA2', 'nota2', 'Veja https://exemplo.com/prova');
    expect(link.statusCode).toBe(400);
    expect(link.json().erro).toMatch(/link/i);
    expect((await pedir('alunoA2', 'nota2', 'veja www.exemplo.com')).statusCode).toBe(400);
    const extra = await chamar('POST', `/notas-oficiais/${ids.nota2}/pedidos`, 'alunoA2', {
      texto: 'ok',
      anexo: 'x',
    });
    expect(extra.statusCode).toBe(400);
  });

  it('quem pediu vê só os próprios pedidos; professor vê os das suas turmas', async () => {
    const meus = async (q: string) => (await chamar('GET', '/pedidos-revisao', q)).json().pedidos;
    expect((await meus('alunoA')).map((p: { id: string }) => p.id)).toEqual([ids.pedidoAluno]);
    expect(await meus('alunoA2')).toEqual([]);
    expect((await meus('pedA')).map((p: { id: string }) => p.id)).toEqual([ids.pedidoPed]);
    expect((await meus('adminA')).map((p: { id: string }) => p.id)).toEqual([ids.pedidoAdmin]);
    const prof = await meus('profA');
    expect(prof).toHaveLength(4);
    expect(
      prof.every(
        (p: { estado: string; pode_responder: boolean }) =>
          p.estado === 'aberto' && p.pode_responder,
      ),
    ).toBe(true);
    expect(await meus('profSem')).toEqual([]);
    expect(await meus('profB')).toEqual([]);
    expect(await meus('adminB')).toEqual([]);
    expect((await chamar('GET', '/pedidos-revisao', 'profC')).json().pedidos).toHaveLength(4);
    expect(
      (await chamar('GET', '/pedidos-revisao', 'profC'))
        .json()
        .pedidos.every((p: { pode_responder: boolean }) => !p.pode_responder),
    ).toBe(true);
  });
});

describe('revisão da nota (nova versão, nada se apaga)', () => {
  const revisar = (quem: string, nota: string, corpo: unknown) =>
    chamar('POST', `/notas-oficiais/${ids[nota]}/revisoes`, quem, corpo);

  it('só o professor que lançou revisa: outro professor da mesma turma, Admin e outra escola são negados', async () => {
    const corpo = { valor: 8, motivo: 'Conferi a prova.' };
    expect((await revisar('profC', 'nota1', corpo)).statusCode).toBe(403);
    expect((await revisar('profSem', 'nota1', corpo)).statusCode).toBe(403);
    expect((await revisar('adminA', 'nota1', corpo)).statusCode).toBe(403);
    expect((await revisar('pedA', 'nota1', corpo)).statusCode).toBe(403);
    expect((await revisar('profB', 'nota1', corpo)).statusCode).toBe(404);
    const auditoria = await amb.admin.query(
      "SELECT count(*)::int AS n FROM auditoria_evento WHERE acao = 'nota.revisao_negada'",
    );
    expect(auditoria.rows[0].n).toBeGreaterThanOrEqual(2);
  });

  it('exige motivo, valor válido e valor diferente do atual', async () => {
    expect((await revisar('profA', 'nota1', { valor: 8 })).statusCode).toBe(400);
    expect((await revisar('profA', 'nota1', { valor: 8, motivo: '  ' })).statusCode).toBe(400);
    expect((await revisar('profA', 'nota1', { valor: 11, motivo: 'x' })).statusCode).toBe(400);
    expect((await revisar('profA', 'nota1', { valor: 7.5, motivo: 'x' })).statusCode).toBe(422);
  });

  it('revisa ligando ao pedido: a nota ganha a versão 2 e o pedido fica "revisada"', async () => {
    const r = await revisar('profA', 'nota1', {
      valor: 8.3,
      motivo: 'Somei um item que faltava.',
      pedido_id: ids.pedidoAluno,
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().versao).toBe(2);
    // Fechar juntos (L16): os outros 3 pedidos abertos da mesma nota fecham com a mesma versão
    expect(r.json().pedidos_fechados).toBe(4);
    const aluno = (await chamar('GET', '/notas-oficiais', 'alunoA')).json().notas[0];
    expect(aluno.valor).toBe(8.3);
    expect(aluno).not.toHaveProperty('versoes');
    const meu = (await chamar('GET', '/pedidos-revisao', 'alunoA')).json().pedidos[0];
    expect(meu).toMatchObject({ estado: 'revisada', valor_atual: 8.3 });
    // A-027: quem pediu não recebe o motivo da revisão nem o número de versão; o professor recebe
    expect(meu.motivo_resposta).toBe('');
    expect(meu.versao_atual).toBeNull();
    const doProf = (await chamar('GET', '/pedidos-revisao', 'profA'))
      .json()
      .pedidos.find((p: { id: string }) => p.id === ids.pedidoAluno);
    expect(doProf.motivo_resposta).toBe('Somei um item que faltava.');
    for (const quem of ['adminA', 'pedA', 'alunoA', 'respA']) {
      const corpo = (await chamar('GET', '/pedidos-revisao', quem)).body;
      expect(corpo, quem).not.toContain('Somei um item que faltava.');
    }
    // a versão anterior continua visível ao professor e ao Admin
    for (const quem of ['profA', 'adminA']) {
      const nota = (await chamar('GET', '/notas-oficiais', quem))
        .json()
        .notas.find((n: { id: string }) => n.id === ids.nota1);
      expect(
        nota.versoes.map((v: { numero: number; valor: number }) => [v.numero, v.valor]),
      ).toEqual([
        [2, 8.3],
        [1, 7.5],
      ]);
    }
    expect(
      (await revisar('profA', 'nota1', { valor: 9, motivo: 'x', pedido_id: ids.pedidoAluno }))
        .statusCode,
    ).toBe(409);
  });

  it('o Pedagógico vê só o valor novo, sem o histórico', async () => {
    const nota = (await chamar('GET', '/notas-oficiais', 'pedA'))
      .json()
      .notas.find((n: { id: string }) => n.id === ids.nota1);
    expect(nota.valor).toBe(8.3);
    expect(nota).not.toHaveProperty('versoes');
  });
});

describe('resposta "mantida"', () => {
  const manter = (quem: string, pedido: string, corpo: unknown) =>
    chamar('POST', `/pedidos-revisao/${ids[pedido]}/manter`, quem, corpo);

  it('só o professor que lançou responde; exige motivo; não responde duas vezes', async () => {
    // Os pedidos da nota 1 já fecharam juntos na revisão; estes são sobre a nota 2
    const a = await chamar('POST', `/notas-oficiais/${ids.nota2}/pedidos`, 'adminA', {
      texto: 'Pode olhar de novo?',
    });
    ids.pedidoAdmin2 = a.json().id;
    const b = await chamar('POST', `/notas-oficiais/${ids.nota2}/pedidos`, 'alunoA2', {
      texto: 'Acho que faltou um item.',
    });
    ids.pedidoAluno2 = b.json().id;
    expect((await manter('profC', 'pedidoAdmin2', { motivo: 'x' })).statusCode).toBe(403);
    expect((await manter('adminA', 'pedidoAdmin2', { motivo: 'x' })).statusCode).toBe(403);
    expect((await manter('alunoA2', 'pedidoAdmin2', { motivo: 'x' })).statusCode).toBe(403);
    expect((await manter('profB', 'pedidoAdmin2', { motivo: 'x' })).statusCode).toBe(404);
    expect((await manter('profA', 'pedidoAdmin2', {})).statusCode).toBe(400);
    expect((await manter('profA', 'pedidoAdmin2', { motivo: ' ' })).statusCode).toBe(400);
    expect(
      (await manter('profA', 'pedidoAdmin2', { motivo: 'A correção está certa.' })).statusCode,
    ).toBe(204);
    expect((await manter('profA', 'pedidoAdmin2', { motivo: 'de novo' })).statusCode).toBe(409);
    const admin = (await chamar('GET', '/pedidos-revisao', 'adminA'))
      .json()
      .pedidos.find((p: { id: string }) => p.id === ids.pedidoAdmin2);
    expect(admin).toMatchObject({ estado: 'mantida', motivo_resposta: 'A correção está certa.' });
  });

  it('o professor vê abertos primeiro e os respondidos depois', async () => {
    const lista = (await chamar('GET', '/pedidos-revisao', 'profA')).json().pedidos;
    expect(lista).toHaveLength(6);
    expect(lista[0]).toMatchObject({
      id: ids.pedidoAluno2,
      estado: 'aberto',
      pode_responder: true,
    });
    expect(lista.slice(1).every((p: { estado: string }) => p.estado !== 'aberto')).toBe(true);
  });
});

describe('fechar juntos (L16)', () => {
  const pedirEm = (quem: string, nota: string) =>
    chamar('POST', `/notas-oficiais/${nota}/pedidos`, quem, { texto: 'Pode conferir a nota?' });

  it('revisar a nota fecha os outros pedidos abertos da mesma nota, na mesma transação, e só dela', async () => {
    ids.nota3 = (await lancar('profA', 'alunoA2', 'turmaA', 'discA', 5)).json().id;
    for (const quem of ['alunoA2', 'respA2', 'pedA'])
      expect((await pedirEm(quem, ids.nota3 as string)).statusCode, quem).toBe(201);
    const abertos = await amb.admin.query(
      "SELECT id, pedido_por FROM pedido_revisao WHERE nota_id = $1 AND estado = 'aberto'",
      [ids.nota3],
    );
    expect(abertos.rows).toHaveLength(3);
    const pedidoDoAluno = abertos.rows.find((r) => r.pedido_por === ids.alunoA2).id;

    const r = await chamar('POST', `/notas-oficiais/${ids.nota3}/revisoes`, 'profA', {
      valor: 6.5,
      motivo: 'Conferi a questão 3.',
      pedido_id: pedidoDoAluno,
    });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ versao: 2, pedidos_fechados: 3 });

    // Todos ligados à nova versão, com a mesma data e hora da versão (mesma transação)
    const versao = (
      await amb.admin.query(
        'SELECT id, criado_em FROM nota_oficial_versao WHERE nota_id = $1 AND numero = 2',
        [ids.nota3],
      )
    ).rows[0];
    const fechados = (
      await amb.admin.query(
        'SELECT estado, versao_resposta_id, respondido_em, respondido_por FROM pedido_revisao WHERE nota_id = $1',
        [ids.nota3],
      )
    ).rows;
    expect(fechados).toHaveLength(3);
    for (const p of fechados) {
      expect(p.estado).toBe('revisada');
      expect(p.versao_resposta_id).toBe(versao.id);
      expect(p.respondido_por).toBe(ids.profA);
      expect(p.respondido_em.getTime()).toBe(versao.criado_em.getTime());
    }
    // Pedido de outra nota continua aberto
    const outra = await amb.admin.query('SELECT estado FROM pedido_revisao WHERE id = $1', [
      ids.pedidoAluno2,
    ]);
    expect(outra.rows[0].estado).toBe('aberto');
    // Cada pedido fechado é auditado; só o indicado ficou de fora da marca "fechado junto"
    const auditoria = await amb.admin.query(
      "SELECT depois FROM auditoria_evento WHERE acao = 'pedido_revisao.respondido' AND alvo = ANY($1)",
      [
        (
          await amb.admin.query('SELECT id FROM pedido_revisao WHERE nota_id = $1', [ids.nota3])
        ).rows.map((x) => `pedido_revisao:${x.id}`),
      ],
    );
    expect(auditoria.rows).toHaveLength(3);
    expect(auditoria.rows.filter((a) => a.depois.fechado_junto === true)).toHaveLength(2);
    // A-027: ninguém além do professor lê o motivo; o Pedagógico não vê o histórico
    for (const quem of ['alunoA2', 'respA2', 'pedA']) {
      const corpo = (await chamar('GET', '/pedidos-revisao', quem)).body;
      expect(corpo, quem).not.toContain('Conferi a questão 3.');
    }
  });

  it('revisar sem indicar pedido também fecha os pedidos abertos da nota', async () => {
    ids.nota4 = (await lancar('profA', 'alunoA', 'turmaA', 'discA', 3)).json().id;
    expect((await pedirEm('alunoA', ids.nota4 as string)).statusCode).toBe(201);
    const r = await chamar('POST', `/notas-oficiais/${ids.nota4}/revisoes`, 'profA', {
      valor: 4,
      motivo: 'Ajuste de soma.',
    });
    expect(r.json().pedidos_fechados).toBe(1);
    const abertos = await amb.admin.query(
      "SELECT count(*)::int AS n FROM pedido_revisao WHERE nota_id = $1 AND estado = 'aberto'",
      [ids.nota4],
    );
    expect(abertos.rows[0].n).toBe(0);
  });

  it('revisão recusada (valor igual) não fecha nenhum pedido', async () => {
    ids.nota5 = (await lancar('profA', 'alunoA', 'turmaA', 'discA', 2)).json().id;
    expect((await pedirEm('alunoA', ids.nota5 as string)).statusCode).toBe(201);
    const r = await chamar('POST', `/notas-oficiais/${ids.nota5}/revisoes`, 'profA', {
      valor: 2,
      motivo: 'Igual.',
    });
    expect(r.statusCode).toBe(422);
    const abertos = await amb.admin.query(
      "SELECT count(*)::int AS n FROM pedido_revisao WHERE nota_id = $1 AND estado = 'aberto'",
      [ids.nota5],
    );
    expect(abertos.rows[0].n).toBe(1);
  });
});

describe('banco: RLS, append-only e gatilhos', () => {
  it('sem contexto nada aparece; com o contexto de A, nada de B', async () => {
    for (const tabela of ['nota_oficial', 'nota_oficial_versao', 'pedido_revisao']) {
      expect(
        await amb.bancoApp.$queryRawUnsafe<unknown[]>(`SELECT * FROM ${tabela}`),
        tabela,
      ).toEqual([]);
      const deA = await withTenant(amb.bancoApp, { instituicaoId: amb.instA }, (tx) =>
        tx.$queryRawUnsafe<{ instituicao_id: string }[]>(`SELECT instituicao_id FROM ${tabela}`),
      );
      expect(deA.length, tabela).toBeGreaterThan(0);
      expect(
        deA.every((l) => l.instituicao_id === amb.instA),
        tabela,
      ).toBe(true);
    }
  });

  it('o banco recusa gravar em B com o contexto de A', async () => {
    await expect(
      withTenant(
        amb.bancoApp,
        { instituicaoId: amb.instA },
        (tx) =>
          tx.$executeRaw`INSERT INTO nota_oficial_versao (instituicao_id, nota_id, numero, valor, autor_id)
                       VALUES (${amb.instB}::uuid, ${ids.notaB}::uuid, 2, 5, ${ids.profB}::uuid)`,
      ),
    ).rejects.toThrow();
  });

  it('nota e versões não aceitam UPDATE nem DELETE; pedido não aceita DELETE', async () => {
    for (const sql of [
      'UPDATE nota_oficial SET dia = now()',
      'DELETE FROM nota_oficial',
      'UPDATE nota_oficial_versao SET valor = 10',
      'DELETE FROM nota_oficial_versao',
      'DELETE FROM pedido_revisao',
    ]) {
      await expect(
        withTenant(amb.bancoApp, { instituicaoId: amb.instA }, (tx) => tx.$executeRawUnsafe(sql)),
        sql,
      ).rejects.toThrow();
    }
  });

  it('pedido já respondido não muda mais, nem pelo banco', async () => {
    await expect(
      withTenant(
        amb.bancoApp,
        { instituicaoId: amb.instA },
        (tx) =>
          tx.$executeRaw`UPDATE pedido_revisao SET motivo_resposta = 'outro' WHERE id = ${ids.pedidoAdmin}::uuid`,
      ),
    ).rejects.toThrow(/respondido/);
  });

  it('o banco confere professor, vínculo e ordem de versões mesmo se a API fosse contornada', async () => {
    const tentar = (sql: string, p: unknown[]) => amb.admin.query(sql, p);
    await expect(
      tentar(
        "INSERT INTO nota_oficial (instituicao_id, aluno_id, turma_id, disciplina_id, professor_id, dia) VALUES ($1,$2,$3,$4,$5,'2026-11-05')",
        [amb.instA, ids.alunoA, ids.turmaA, ids.discA, ids.profSem],
      ),
    ).rejects.toThrow(/vinculo/);
    await expect(
      tentar(
        "INSERT INTO nota_oficial_versao (instituicao_id, nota_id, numero, valor, motivo, autor_id) VALUES ($1,$2,3,5,'x',$3)",
        [amb.instA, ids.nota1, ids.profC],
      ),
    ).rejects.toThrow(/lancou/);
    await expect(
      tentar(
        "INSERT INTO nota_oficial_versao (instituicao_id, nota_id, numero, valor, motivo, autor_id) VALUES ($1,$2,9,5,'x',$3)",
        [amb.instA, ids.nota1, ids.profA],
      ),
    ).rejects.toThrow(/ordem/);
    await expect(
      tentar(
        "INSERT INTO pedido_revisao (instituicao_id, nota_id, pedido_por, perfil_pedinte, texto) VALUES ($1,$2,$3,'admin','oi')",
        [amb.instA, ids.nota2, ids.alunoA2],
      ),
    ).rejects.toThrow(/perfil/);
  });

  it('a auditoria registra lançamento, revisão, pedido e resposta e a cadeia está íntegra', async () => {
    const acoes = await amb.admin.query(
      "SELECT DISTINCT acao FROM auditoria_evento WHERE instituicao_id = $1 AND acao ~ '^(nota|pedido_revisao)\\.'",
      [amb.instA],
    );
    expect(acoes.rows.map((r) => r.acao)).toEqual(
      expect.arrayContaining([
        'nota.lancada',
        'nota.revisada',
        'pedido_revisao.aberto',
        'pedido_revisao.respondido',
      ]),
    );
    for (const inst of [amb.instA, amb.instB]) {
      expect(
        await withTenant(amb.bancoApp, { instituicaoId: inst }, (tx) => verificarCadeia(tx)),
      ).toEqual([]);
    }
  });
});
