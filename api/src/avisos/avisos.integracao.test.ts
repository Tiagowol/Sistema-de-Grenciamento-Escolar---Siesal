import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { verificarCadeia } from '../auditoria/auditoria.js';
import { hashSenha } from '../auth/senha.js';
import { base32Decodificar, codigoTotp, passoDe } from '../auth/totp.js';
import { withTenant } from '../banco/withTenant.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// Sino de mensagens (L16): caixa por perfil, "visto", avisos curtos e fechar juntos.
// Isolamento entre instituições (A x B) e entre turmas, A-027 (Pedagógico sem motivo nem versões antigas),
// perfil sem permissão negado e auditado. Só dados fictícios.
const SENHA = 'senha de teste longa 123';
const MOTIVO_REVISAO = 'MOTIVO-SECRETO-DA-REVISAO';
const MOTIVO_MANTIDA = 'MOTIVO-DA-RESPOSTA-MANTIDA';
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
const auditorias = async (acao: string, quem?: string) =>
  (
    await amb.admin.query(
      'SELECT count(*)::int AS n FROM auditoria_evento WHERE acao = $1 AND ($2::text IS NULL OR ator = $2)',
      [acao, quem ? `usuario:${ids[quem]}` : null],
    )
  ).rows[0].n as number;

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
    ['professor', 'profA'], // turma A
    ['professor', 'profD'], // turma A2
    ['professor', 'profSem'], // sem vínculo
    ['aluno', 'alunoA'],
    ['aluno', 'alunoA2'],
    ['responsavel', 'respA'],
    ['responsavel', 'respA2'],
    ['pedagogico', 'pedA'],
    ['pedagogico', 'pedA2'],
  ] as const)
    await criarPessoa(A, perfil, apelido);
  for (const [perfil, apelido] of [
    ['admin', 'adminB'],
    ['professor', 'profB'],
    ['aluno', 'alunoB'],
    ['responsavel', 'respB'],
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
  const disc = (inst: string) =>
    nova("INSERT INTO disciplina (instituicao_id, nome) VALUES ($1,'Matemática') RETURNING id", [
      inst,
    ]);
  ids.turmaA = await turma(A, '7º A');
  ids.turmaA2 = await turma(A, '7º B');
  ids.discA = await disc(A);
  ids.turmaB = await turma(B, '7º A');
  ids.discB = await disc(B);
  await vincular(A, 'professor_turma', ids.profA as string, ids.turmaA, ids.discA);
  await vincular(A, 'professor_turma', ids.profD as string, ids.turmaA2, ids.discA);
  await vincular(A, 'aluno_turma', ids.alunoA as string, ids.turmaA);
  await vincular(A, 'aluno_turma', ids.alunoA2 as string, ids.turmaA2);
  await vincular(A, 'responsavel_aluno', ids.respA as string, undefined, undefined, ids.alunoA);
  await vincular(A, 'responsavel_aluno', ids.respA2 as string, undefined, undefined, ids.alunoA2);
  await vincular(B, 'professor_turma', ids.profB as string, ids.turmaB, ids.discB);
  await vincular(B, 'aluno_turma', ids.alunoB as string, ids.turmaB);
  await vincular(B, 'responsavel_aluno', ids.respB as string, undefined, undefined, ids.alunoB);
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

const lancar = async (quem: string, aluno: string, turma: string, valor: number) =>
  (
    await chamar('POST', '/notas-oficiais', quem, {
      aluno_id: ids[aluno],
      turma_id: ids[turma],
      disciplina_id: ids.discA,
      descricao: 'Prova 1',
      valor,
      dia: '2026-11-05',
    })
  ).json().id as string;
const pedir = (quem: string, nota: string) =>
  chamar('POST', `/notas-oficiais/${ids[nota]}/pedidos`, quem, { texto: 'Pode conferir a nota?' });

describe('caixa do sino Mensagens: cada perfil vê só o que é seu', () => {
  it('professor vê os pedidos abertos das suas turmas; sem vínculo e de outra escola, nada', async () => {
    ids.nota1 = await lancar('profA', 'alunoA', 'turmaA', 7.5);
    ids.nota2 = await lancar('profD', 'alunoA2', 'turmaA2', 4);
    for (const quem of ['alunoA', 'respA', 'adminA', 'pedA'])
      expect((await pedir(quem, 'nota1')).statusCode, quem).toBe(201);
    expect((await pedir('alunoA2', 'nota2')).statusCode).toBe(201);

    const a = await caixa('profA');
    expect(a.itens).toHaveLength(4);
    expect(a.nao_vistos).toBe(4);
    expect(a.itens.every((i) => i.tipo === 'pedido_aberto' && i.pode_responder === true)).toBe(
      true,
    );
    // Entre turmas: o professor da turma B (outra turma) não vê os pedidos da turma A, e vice-versa
    const d = await caixa('profD');
    expect(d.itens).toHaveLength(1);
    expect(d.itens[0]?.aluno_nome).toBe('Pessoa alunoA2');
    expect((await caixa('profSem')).itens).toEqual([]);
    // Entre instituições: a Escola B não vê nada da Escola A
    for (const quem of ['profB', 'adminB', 'pedB', 'alunoB', 'respB'])
      expect((await caixa(quem)).itens, quem).toEqual([]);
  });

  it('quem pediu não vê nada enquanto o pedido está aberto; aluno de outra turma não vê o de outro', async () => {
    for (const quem of ['alunoA', 'respA', 'adminA', 'pedA', 'alunoA2'])
      expect((await caixa(quem)).itens, quem).toEqual([]);
  });

  it('abrir a caixa marca como visto e audita só quando algo muda de estado', async () => {
    const antes = await auditorias('caixa.aberta', 'profA');
    const r = await chamar('POST', '/caixa/vistos', 'profA');
    expect(r.json().marcados).toBe(4);
    expect(await auditorias('caixa.aberta', 'profA')).toBe(antes + 1);
    const depois = await caixa('profA');
    expect(depois.nao_vistos).toBe(0);
    expect(depois.itens).toHaveLength(4); // continuam na caixa; só deixam de contar
    // Segunda abertura: nada muda, nada é auditado
    expect((await chamar('POST', '/caixa/vistos', 'profA')).json().marcados).toBe(0);
    expect(await auditorias('caixa.aberta', 'profA')).toBe(antes + 1);
    // O visto é de cada pessoa: o outro professor continua com o dele
    expect((await caixa('profD')).nao_vistos).toBe(1);
  });
});

describe('respostas, fechar juntos e A-027', () => {
  it('revisar fecha os 4 pedidos da nota; cada um vê só a resposta ao seu pedido, sem motivo nem versões', async () => {
    const r = await chamar('POST', `/notas-oficiais/${ids.nota1}/revisoes`, 'profA', {
      valor: 9,
      motivo: MOTIVO_REVISAO,
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().pedidos_fechados).toBe(4);
    // O pedido sai da caixa do professor
    expect((await caixa('profA')).itens).toEqual([]);
    for (const quem of ['alunoA', 'respA', 'adminA', 'pedA']) {
      const c = await caixa(quem);
      expect(c.itens, quem).toHaveLength(1);
      expect(c.nao_vistos, quem).toBe(1);
      const item = c.itens[0] as Item;
      expect(item).toMatchObject({ tipo: 'resposta', estado: 'revisada', valor_atual: 9 });
      expect(item.dia).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Só estado, nota atual e data: sem motivo, sem versão anterior, sem histórico
      expect(item.motivo).toBe('');
      expect(
        Object.keys(item).filter((k) => /versao|versoes|historico|valor_anterior/.test(k)),
      ).toEqual([]);
      const corpo = (await chamar('GET', '/caixa', quem)).body;
      expect(corpo, quem).not.toContain(MOTIVO_REVISAO);
      expect(corpo, quem).not.toContain('7.5');
    }
  });

  it('o Pedagógico não recebe o motivo da revisão nem as versões antigas em nenhuma rota', async () => {
    for (const rota of ['/caixa', '/pedidos-revisao', '/notas-oficiais']) {
      const corpo = (await chamar('GET', rota, 'pedA')).body;
      expect(corpo, rota).not.toContain(MOTIVO_REVISAO);
      expect(corpo, rota).not.toMatch(/versoes/);
    }
    const nota = (await chamar('GET', '/notas-oficiais', 'pedA'))
      .json()
      .notas.find((n: { id: string }) => n.id === ids.nota1);
    expect(nota.valor).toBe(9);
    expect(nota).not.toHaveProperty('versoes');
    // Aluno e responsável também não
    for (const quem of ['alunoA', 'respA']) {
      for (const rota of ['/pedidos-revisao', '/notas-oficiais'])
        expect((await chamar('GET', rota, quem)).body, `${quem} ${rota}`).not.toContain(
          MOTIVO_REVISAO,
        );
    }
    // O professor e o Admin continuam vendo o motivo e a versão antiga
    for (const quem of ['profA', 'adminA']) {
      const n = (await chamar('GET', '/notas-oficiais', quem))
        .json()
        .notas.find((x: { id: string }) => x.id === ids.nota1);
      expect(n.versoes.map((v: { valor: number }) => v.valor)).toEqual([9, 7.5]);
      expect(n.versoes[0].motivo).toBe(MOTIVO_REVISAO);
    }
  });

  it('o motivo de "mantida" aparece só a quem fez o pedido', async () => {
    const pedido = (
      await amb.admin.query(
        "SELECT id FROM pedido_revisao WHERE nota_id = $1 AND estado = 'aberto'",
        [ids.nota2],
      )
    ).rows[0].id;
    const m = await chamar('POST', `/pedidos-revisao/${pedido}/manter`, 'profD', {
      motivo: MOTIVO_MANTIDA,
    });
    expect(m.statusCode).toBe(204);
    const dele = await caixa('alunoA2');
    expect(dele.itens[0]).toMatchObject({
      estado: 'mantida',
      motivo: MOTIVO_MANTIDA,
      valor_atual: 4,
    });
    for (const quem of ['respA2', 'respA', 'pedA', 'adminA', 'alunoA', 'profA'])
      expect((await chamar('GET', '/caixa', quem)).body, quem).not.toContain(MOTIVO_MANTIDA);
    expect((await caixa('profD')).itens).toEqual([]);
  });

  it('o visto da resposta é de cada pessoa e abrir a caixa audita a mudança', async () => {
    const r = await chamar('POST', '/caixa/vistos', 'alunoA');
    expect(r.json().marcados).toBe(1);
    expect((await caixa('alunoA')).nao_vistos).toBe(0);
    expect((await caixa('respA')).nao_vistos).toBe(1);
    expect(await auditorias('caixa.aberta', 'alunoA')).toBe(1);
  });
});

describe('avisos curtos (só leitura)', () => {
  const publicar = (quem: string, corpo: unknown) =>
    chamar('POST', '/avisos-escolares', quem, corpo);

  it('perfil sem permissão é negado e a tentativa é auditada; sem sessão, 401', async () => {
    for (const quem of ['alunoA', 'respA', 'profA', 'profSem']) {
      expect((await publicar(quem, { texto: 'Oi', turma_id: ids.turmaA })).statusCode, quem).toBe(
        403,
      );
      expect((await chamar('GET', '/avisos-escolares', quem)).statusCode, quem).toBe(403);
      expect(
        (await chamar('POST', `/avisos-escolares/${randomUUID()}/desativar`, quem)).statusCode,
        quem,
      ).toBe(403);
      expect(await auditorias('avisos.acesso_negado', quem), quem).toBeGreaterThan(0);
    }
    for (const rota of ['/caixa', '/avisos-escolares'])
      expect((await app.inject({ method: 'GET', url: rota })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/caixa/vistos' })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'POST', url: '/avisos-escolares', payload: { texto: 'x' } }))
        .statusCode,
    ).toBe(401);
  });

  it('valida o texto: vazio, longo, com link e campo extra são recusados', async () => {
    const turma_id = ids.turmaA;
    expect((await publicar('pedA', { texto: '  ', turma_id })).statusCode).toBe(400);
    expect((await publicar('pedA', { texto: 'a'.repeat(301), turma_id })).statusCode).toBe(400);
    const link = await publicar('pedA', { texto: 'Veja https://exemplo.com', turma_id });
    expect(link.statusCode).toBe(400);
    expect(link.json().erro).toMatch(/link/i);
    expect((await publicar('pedA', { texto: 'veja www.exemplo.com', turma_id })).statusCode).toBe(
      400,
    );
    expect((await publicar('pedA', { texto: 'ok', turma_id, anexo: 'x' })).statusCode).toBe(400);
  });

  it('Pedagógico exige turma da própria instituição; Admin fala com a instituição inteira', async () => {
    expect((await publicar('pedA', { texto: 'Sem turma' })).statusCode).toBe(400);
    expect(
      (await publicar('adminA', { texto: 'Com turma', turma_id: ids.turmaA })).statusCode,
    ).toBe(400);
    expect(
      (await publicar('pedA', { texto: 'Turma de outra escola', turma_id: ids.turmaB })).statusCode,
    ).toBe(404);
    expect(
      (await publicar('pedB', { texto: 'Turma da escola A', turma_id: ids.turmaA })).statusCode,
    ).toBe(404);
    expect(
      (await publicar('pedA', { texto: 'Turma inexistente', turma_id: randomUUID() })).statusCode,
    ).toBe(404);
  });

  it('aviso de turma chega só a alunos e responsáveis daquela turma; o de instituição, a toda a escola A', async () => {
    const t = await publicar('pedA', { texto: 'Reunião da turma na sexta.', turma_id: ids.turmaA });
    expect(t.statusCode).toBe(201);
    ids.avisoTurma = t.json().id;
    const i = await publicar('adminA', { texto: 'Aula suspensa dia 20/11.' });
    expect(i.statusCode).toBe(201);
    ids.avisoInst = i.json().id;
    const textos = async (quem: string) =>
      (await caixa(quem)).itens.filter((x) => x.tipo === 'aviso').map((x) => x.id);
    // Turma A: aluno e responsável da turma A veem os dois
    for (const quem of ['alunoA', 'respA'])
      expect(new Set(await textos(quem)), quem).toEqual(new Set([ids.avisoTurma, ids.avisoInst]));
    // Outra turma da mesma escola: só o aviso da instituição
    for (const quem of ['alunoA2', 'respA2'])
      expect(await textos(quem), quem).toEqual([ids.avisoInst]);
    // Outra escola: nada
    for (const quem of ['alunoB', 'respB']) expect(await textos(quem), quem).toEqual([]);
    // Professor, Pedagógico e Admin não recebem aviso na caixa (só publicam)
    for (const quem of ['profA', 'pedA', 'adminA', 'pedB'])
      expect(await textos(quem), quem).toEqual([]);
    expect(await auditorias('aviso.publicado')).toBe(2);
    // O aviso conta como não visto e fica visto ao abrir a caixa
    const antes = await caixa('alunoA2');
    expect(antes.nao_vistos).toBeGreaterThanOrEqual(1);
    await chamar('POST', '/caixa/vistos', 'alunoA2');
    expect((await caixa('alunoA2')).nao_vistos).toBe(0);
  });

  it('a lista de turmas para publicar traz só as turmas da própria escola e só para quem publica', async () => {
    const nomes = async (quem: string) =>
      (
        (await chamar('GET', '/avisos-escolares/turmas', quem)).json().turmas as { id: string }[]
      ).map((t) => t.id);
    expect(new Set(await nomes('pedA'))).toEqual(new Set([ids.turmaA, ids.turmaA2]));
    expect(await nomes('pedB')).toEqual([ids.turmaB]);
    expect((await chamar('GET', '/avisos-escolares/turmas', 'alunoA')).statusCode).toBe(403);
    expect((await chamar('GET', '/avisos-escolares/turmas', 'profA')).statusCode).toBe(403);
  });

  it('o autor lista os próprios avisos; o Admin vê os da instituição; B não vê os de A', async () => {
    const lista = async (quem: string) =>
      ((await chamar('GET', '/avisos-escolares', quem)).json().avisos as { id: string }[]).map(
        (a) => a.id,
      );
    expect(await lista('pedA')).toEqual([ids.avisoTurma]);
    expect(await lista('pedA2')).toEqual([]);
    expect(new Set(await lista('adminA'))).toEqual(new Set([ids.avisoTurma, ids.avisoInst]));
    expect(await lista('adminB')).toEqual([]);
    expect(await lista('pedB')).toEqual([]);
  });

  it('desativar: só o autor ou o Admin; nada se apaga; some da caixa; audita', async () => {
    expect(
      (await chamar('POST', `/avisos-escolares/${ids.avisoTurma}/desativar`, 'pedA2')).statusCode,
    ).toBe(403);
    expect(await auditorias('aviso.desativacao_negada', 'pedA2')).toBe(1);
    expect(
      (await chamar('POST', `/avisos-escolares/${ids.avisoTurma}/desativar`, 'pedB')).statusCode,
    ).toBe(404);
    expect(
      (await chamar('POST', `/avisos-escolares/${ids.avisoTurma}/desativar`, 'pedA')).statusCode,
    ).toBe(204);
    expect(
      (await chamar('POST', `/avisos-escolares/${ids.avisoTurma}/desativar`, 'pedA')).statusCode,
    ).toBe(409);
    expect(
      (await chamar('POST', `/avisos-escolares/${ids.avisoInst}/desativar`, 'adminB')).statusCode,
    ).toBe(404);
    expect(
      (await chamar('POST', `/avisos-escolares/${ids.avisoInst}/desativar`, 'adminA')).statusCode,
    ).toBe(204);
    for (const quem of ['alunoA', 'respA'])
      expect(
        (await caixa(quem)).itens.filter((x) => x.tipo === 'aviso'),
        quem,
      ).toEqual([]);
    const ainda = await amb.admin.query('SELECT count(*)::int AS n FROM aviso_escolar');
    expect(ainda.rows[0].n).toBe(2);
    expect(await auditorias('aviso.desativado')).toBe(2);
  });
});

describe('banco: RLS, append-only e gatilhos (0009)', () => {
  it('sem contexto nada aparece; com o contexto de A, nada de B', async () => {
    for (const tabela of ['aviso_escolar', 'aviso_visto']) {
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
          tx.$executeRaw`INSERT INTO aviso_escolar (instituicao_id, autor_id, autor_perfil, escopo, texto)
                       VALUES (${amb.instB}::uuid, ${ids.adminB}::uuid, 'admin', 'instituicao', 'x')`,
      ),
    ).rejects.toThrow();
  });

  it('aviso e visto não aceitam DELETE; visto não aceita UPDATE; aviso só aceita desativar', async () => {
    for (const sql of [
      'DELETE FROM aviso_escolar',
      'DELETE FROM aviso_visto',
      'UPDATE aviso_visto SET visto_em = now()',
      "UPDATE aviso_escolar SET texto = 'outro'",
      'UPDATE aviso_escolar SET desativado_em = NULL',
    ]) {
      await expect(
        withTenant(amb.bancoApp, { instituicaoId: amb.instA }, (tx) => tx.$executeRawUnsafe(sql)),
        sql,
      ).rejects.toThrow();
    }
  });

  it('o banco confere perfil e escopo do autor mesmo se a API fosse contornada; Master não existe como autor', async () => {
    const tentar = (
      perfil: string,
      autor: string,
      escopo: string,
      turma: string | null,
      texto = 'ok',
    ) =>
      amb.admin.query(
        'INSERT INTO aviso_escolar (instituicao_id, autor_id, autor_perfil, escopo, turma_id, texto) VALUES ($1,$2,$3,$4,$5,$6)',
        [amb.instA, autor, perfil, escopo, turma, texto],
      );
    await expect(tentar('master', ids.adminA as string, 'instituicao', null)).rejects.toThrow();
    await expect(tentar('admin', ids.alunoA as string, 'instituicao', null)).rejects.toThrow(
      /perfil/,
    );
    await expect(
      tentar('admin', ids.adminA as string, 'turma', ids.turmaA as string),
    ).rejects.toThrow(/escopo/);
    await expect(tentar('pedagogico', ids.pedA as string, 'instituicao', null)).rejects.toThrow(
      /escopo/,
    );
    await expect(
      tentar('pedagogico', ids.pedA as string, 'turma', ids.turmaA as string, 'veja https://x.com'),
    ).rejects.toThrow();
    await expect(
      tentar('pedagogico', ids.pedA as string, 'turma', ids.turmaB as string),
    ).rejects.toThrow();
  });

  it('o visto exige exatamente um item e não se repete', async () => {
    const pedido = (await amb.admin.query('SELECT id FROM pedido_revisao LIMIT 1')).rows[0].id;
    await expect(
      amb.admin.query('INSERT INTO aviso_visto (instituicao_id, usuario_id) VALUES ($1,$2)', [
        amb.instA,
        ids.alunoA,
      ]),
    ).rejects.toThrow();
    const dup = (
      await amb.admin.query(
        'SELECT usuario_id, pedido_id FROM aviso_visto WHERE pedido_id IS NOT NULL LIMIT 1',
      )
    ).rows[0];
    await expect(
      amb.admin.query(
        'INSERT INTO aviso_visto (instituicao_id, usuario_id, pedido_id) VALUES ($1,$2,$3)',
        [amb.instA, dup.usuario_id, dup.pedido_id],
      ),
    ).rejects.toThrow();
    expect(pedido).toBeTruthy();
  });

  it('a auditoria registra publicação, desativação e abertura da caixa e a cadeia está íntegra', async () => {
    const acoes = await amb.admin.query(
      "SELECT DISTINCT acao FROM auditoria_evento WHERE instituicao_id = $1 AND acao ~ '^(aviso|caixa)\\.'",
      [amb.instA],
    );
    expect(acoes.rows.map((r) => r.acao)).toEqual(
      expect.arrayContaining(['aviso.publicado', 'aviso.desativado', 'caixa.aberta']),
    );
    for (const inst of [amb.instA, amb.instB]) {
      expect(
        await withTenant(amb.bancoApp, { instituicaoId: inst }, (tx) => verificarCadeia(tx)),
      ).toEqual([]);
    }
  });
});

// AUD-03: nenhuma resposta escolar ou de sessão fica em cache; só a saúde fica de fora
describe('cache: Cache-Control no-store nas respostas da API', () => {
  it('rotas escolares autenticadas, erros e login respondem no-store', async () => {
    for (const [quem, url] of [
      ['profA', '/caixa'],
      ['profA', '/notas-oficiais'],
      ['profA', '/pedidos-revisao'],
      ['alunoA', '/avisos-escolares'],
      ['alunoA', '/auth/eu'],
      ['alunoA', '/tarefas'],
    ] as const) {
      const r = await chamar('GET', url, quem);
      expect(r.headers['cache-control'], url).toBe('no-store');
    }
    const semSessao = await app.inject({ method: 'GET', url: '/caixa' });
    expect(semSessao.statusCode).toBe(401);
    expect(semSessao.headers['cache-control']).toBe('no-store');
    const config = await app.inject({ method: 'GET', url: '/config' });
    expect(config.headers['cache-control']).toBe('no-store');
    const saude = await app.inject({ method: 'GET', url: '/saude' });
    expect(saude.headers['cache-control']).toBeUndefined();
  });
});
