import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { hashCodigo } from '../auth/codigos.js';
import type { Email } from '../auth/email.js';
import { hashSenha } from '../auth/senha.js';
import { base32Decodificar, codigoTotp, passoDe } from '../auth/totp.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// L22a-2b (migração 0029): acompanhamento por código da instituição. Só dados fictícios.
const SENHA = 'senha de teste longa 123';
const SENHA_ALUNO = 'senha provisoria longa 456';
const SENHA_ALUNO_NOVA = 'senha nova do aluno 789';
const AGORA = new Date('2026-11-13T12:00:00Z');
const NENHUMA = { tarefas: false, dificuldade: false, notas: false, mensagens: false };
const POUCAS = { ...NENHUMA, tarefas: true, notas: true };
let amb: Ambiente;
let app: FastifyInstance;
const enviados: Email[] = [];
const cookies: Record<string, string> = {};

type Metodo = 'GET' | 'POST' | 'PATCH';
const chamar = (metodo: Metodo, url: string, payload?: unknown, cookie?: string) =>
  app.inject({
    method: metodo,
    url,
    payload: payload as object,
    headers: cookie ? { cookie } : {},
  });
const cookieDe = (r: { headers: Record<string, unknown> }) =>
  String(r.headers['set-cookie']).split(';')[0] as string;
const sufixo = () => randomUUID().slice(0, 8);
const dele = (quem: string) => cookies[quem] as string;

// Usuários da instituição (login normal; o Admin ativa o segundo fator)
async function criarUsuario(inst: string, perfil: string, apelido: string) {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@l22b.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
    [id, inst, perfil, `Pessoa ${apelido}`, email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
    [inst, id, await hashSenha(SENHA)],
  );
  const r = await chamar('POST', '/auth/login', { instituicao_id: inst, email, senha: SENHA });
  expect(r.statusCode, r.body).toBe(200);
  let cookie = cookieDe(r);
  if (perfil === 'admin') {
    const ini = await chamar('POST', '/auth/totp/iniciar', {}, cookie);
    const ok = await chamar(
      'POST',
      '/auth/totp/confirmar',
      { codigo: codigoTotp(base32Decodificar(ini.json().segredo), passoDe(AGORA)) },
      cookie,
    );
    expect(ok.statusCode, ok.body).toBe(200);
    cookie = cookieDe(ok);
  }
  cookies[apelido] = cookie;
}

// Pessoa (representante legal) e espaço do aluno menor, como no L22a-2
const tokenDoEmail = (para: string) =>
  [...enviados]
    .reverse()
    .find((x) => x.para === para && /confirmar o seu e-mail/.test(x.texto))
    ?.texto.match(/#([A-Za-z0-9_-]+)/)?.[1] as string;
async function espaco() {
  const email = `rep-${sufixo()}@l22b.exemplo`;
  await chamar('POST', '/auth/pessoa/cadastro', {
    nome: 'Representante Fictício',
    email,
    senha: SENHA,
    papel: 'responsavel',
    aceite: true,
  });
  await chamar('POST', '/auth/pessoa/confirmar-email', { token: tokenDoEmail(email) });
  const l = await chamar('POST', '/auth/pessoa/login', { email, senha: SENHA });
  const cookiePessoa = cookieDe(l);
  const codigo = `ABCD-${sufixo()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, 'X')}-EFGH`;
  await amb.admin.query(
    "INSERT INTO convite_individual (codigo_hash, criado_por, tipo) VALUES ($1, 'teste', 'individual')",
    [hashCodigo(codigo)],
  );
  const alunoEmail = `al-${sufixo()}@l22b.exemplo`;
  const r = await chamar(
    'POST',
    '/auth/pessoa/aluno-menor',
    {
      codigo,
      aluno: {
        nome: 'Aluno Menor',
        email: alunoEmail,
        nascimento: '2015-03-10',
        senha: SENHA_ALUNO,
      },
      representante_nascimento: '1985-06-20',
      aceite: true,
    },
    cookiePessoa,
  );
  expect(r.statusCode, r.body).toBe(201);
  const inst = r.json().instituicao_id as string;
  const cookieRep = cookieDe(
    await chamar('POST', '/auth/pessoa/entrar', { instituicao_id: inst }, cookiePessoa),
  );
  const l1 = await chamar('POST', '/auth/login', {
    sem_instituicao: true,
    email: alunoEmail,
    senha: SENHA_ALUNO,
  });
  await chamar(
    'POST',
    '/auth/senha/trocar',
    { senha_atual: SENHA_ALUNO, senha_nova: SENHA_ALUNO_NOVA },
    cookieDe(l1),
  );
  const l2 = await chamar('POST', '/auth/login', {
    sem_instituicao: true,
    email: alunoEmail,
    senha: SENHA_ALUNO_NOVA,
  });
  const aluno = await amb.admin.query(
    "SELECT id FROM usuario WHERE instituicao_id = $1 AND perfil = 'aluno'",
    [inst],
  );
  const alunoId = aluno.rows[0].id as string;
  await amb.admin.query(
    "INSERT INTO tarefa (instituicao_id, usuario_id, titulo, dificuldade) VALUES ($1, $2, 'Tarefa de ensaio', 6)",
    [inst, alunoId],
  );
  await amb.admin.query(
    "INSERT INTO nota_pessoal (instituicao_id, usuario_id, disciplina, valor, dia) VALUES ($1, $2, 'Matemática', 8.5, current_date)",
    [inst, alunoId],
  );
  return { inst, alunoId, cookieRep, cookieAluno: cookieDe(l2) };
}

// O Admin da instituição A gera o código; devolve o código
const gerarCodigo = async (quem = 'admA') => {
  const r = await chamar(
    'POST',
    '/acompanhamento-instituicao/codigo',
    { acao: 'gerar' },
    dele(quem),
  );
  expect(r.statusCode, r.body).toBe(201);
  return r.json().codigo as string;
};
// Aluno pede, Pedagógico aceita, representante aprova: devolve o id do acompanhamento
async function vinculoAtivo(
  e: Awaited<ReturnType<typeof espaco>>,
  codigo: string,
  itens = POUCAS,
  pedagogo = 'ped1',
) {
  const p = await chamar('POST', '/acompanhamento/instituicao', { codigo, itens }, e.cookieAluno);
  expect(p.statusCode, p.body).toBe(201);
  const fila = (
    await chamar('GET', '/acompanhamento-instituicao/fila', undefined, dele(pedagogo))
  ).json().pedidos as { acompanhamento_id: string }[];
  const q = await amb.admin.query(
    "SELECT id FROM acompanhamento WHERE instituicao_id = $1 AND origem = 'codigo' AND situacao <> 'encerrado'",
    [e.inst],
  );
  const id = q.rows[0].id as string;
  expect(fila.map((x) => x.acompanhamento_id)).toContain(id);
  expect(
    (
      await chamar(
        'POST',
        `/acompanhamento-instituicao/fila/${id}/aceitar`,
        undefined,
        dele(pedagogo),
      )
    ).statusCode,
  ).toBe(200);
  expect(
    (await chamar('POST', `/acompanhamento/${id}/aprovar`, undefined, e.cookieRep)).statusCode,
  ).toBe(200);
  return id;
}

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => AGORA,
    limiteTentativasPorMinuto: 1000,
    enviarEmail: async (m) => {
      enviados.push(m);
    },
  });
  await criarUsuario(amb.instA, 'admin', 'admA');
  await criarUsuario(amb.instA, 'pedagogico', 'ped1');
  await criarUsuario(amb.instA, 'pedagogico', 'ped2');
  await criarUsuario(amb.instA, 'professor', 'profA');
  await criarUsuario(amb.instB, 'admin', 'admB');
  await criarUsuario(amb.instB, 'pedagogico', 'pedB');
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('código da instituição', () => {
  it('só o Admin gera, liga e desliga; o código aparece uma vez e só o hash fica guardado', async () => {
    const codigo = await gerarCodigo();
    expect(codigo).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    const q = await amb.admin.query(
      'SELECT codigo_hash, ativo FROM codigo_acompanhamento WHERE instituicao_id = $1',
      [amb.instA],
    );
    expect(q.rows[0].ativo).toBe(true);
    expect(q.rows[0].codigo_hash).not.toContain(codigo.replace(/-/g, ''));
    expect(
      (await chamar('GET', '/acompanhamento-instituicao/codigo', undefined, dele('admA'))).json(),
    ).toEqual({ ativo: true, tem_codigo: true });
    expect(
      (
        await chamar(
          'POST',
          '/acompanhamento-instituicao/codigo',
          { acao: 'desligar' },
          dele('admA'),
        )
      ).json().ativo,
    ).toBe(false);
    expect(
      (
        await chamar('POST', '/acompanhamento-instituicao/codigo', { acao: 'ligar' }, dele('admA'))
      ).json().ativo,
    ).toBe(true);
    // Pedagógico, professor e outra instituição não mexem no código desta
    for (const quem of ['ped1', 'profA'])
      expect(
        (await chamar('POST', '/acompanhamento-instituicao/codigo', { acao: 'gerar' }, dele(quem)))
          .statusCode,
      ).toBe(403);
    expect(
      (await chamar('GET', '/acompanhamento-instituicao/codigo', undefined, dele('admB'))).json()
        .tem_codigo,
    ).toBe(false);
    // gerar de novo invalida o código antigo
    const novo = await gerarCodigo();
    expect(novo).not.toBe(codigo);
    const e = await espaco();
    expect(
      (
        await chamar(
          'POST',
          '/acompanhamento/instituicao',
          { codigo, itens: NENHUMA },
          e.cookieAluno,
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await chamar(
          'POST',
          '/acompanhamento/instituicao',
          { codigo: novo, itens: NENHUMA },
          e.cookieAluno,
        )
      ).statusCode,
    ).toBe(201);
  });

  it('código errado, desligado e de outra instituição dão a mesma resposta', async () => {
    const e = await espaco();
    const codigo = await gerarCodigo();
    const errado = await chamar(
      'POST',
      '/acompanhamento/instituicao',
      { codigo: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ', itens: NENHUMA },
      e.cookieAluno,
    );
    await chamar('POST', '/acompanhamento-instituicao/codigo', { acao: 'desligar' }, dele('admA'));
    const desligado = await chamar(
      'POST',
      '/acompanhamento/instituicao',
      { codigo, itens: NENHUMA },
      e.cookieAluno,
    );
    await chamar('POST', '/acompanhamento-instituicao/codigo', { acao: 'ligar' }, dele('admA'));
    expect(errado.statusCode).toBe(400);
    expect(desligado.statusCode).toBe(400);
    expect(desligado.json()).toEqual(errado.json());
  });
});

describe('pedido do aluno e fila do Pedagógico', () => {
  it('a fila mostra só nome e caixas; menor só libera depois da aprovação; só o que foi marcado é lido; cada leitura é auditada sem valor', async () => {
    const e = await espaco();
    const codigo = await gerarCodigo();
    const p = await chamar(
      'POST',
      '/acompanhamento/instituicao',
      { codigo, itens: POUCAS },
      e.cookieAluno,
    );
    expect(p.json().aguarda_aprovacao).toBe(true);
    // duplicado
    expect(
      (
        await chamar(
          'POST',
          '/acompanhamento/instituicao',
          { codigo, itens: POUCAS },
          e.cookieAluno,
        )
      ).statusCode,
    ).toBe(409);
    // a fila: só nome do aluno e as caixas pedidas
    const id = (
      await amb.admin.query(
        "SELECT id FROM acompanhamento WHERE instituicao_id = $1 AND origem = 'codigo'",
        [e.inst],
      )
    ).rows[0].id as string;
    const fila = (
      await chamar('GET', '/acompanhamento-instituicao/fila', undefined, dele('ped1'))
    ).json().pedidos as Record<string, unknown>[];
    const meu = fila.find((x) => x.acompanhamento_id === id) as Record<string, unknown>;
    expect(Object.keys(meu).sort()).toEqual([
      'acompanhamento_id',
      'aluno_nome',
      'aprovado',
      'criado_em',
      'ver_dificuldade',
      'ver_mensagens',
      'ver_notas',
      'ver_tarefas',
    ]);
    // quem não é Pedagógico (Admin, professor) não vê a fila nem lê
    for (const quem of ['admA', 'profA'])
      expect(
        (await chamar('GET', '/acompanhamento-instituicao/fila', undefined, dele(quem))).statusCode,
      ).toBe(403);
    expect(
      (
        await chamar(
          'GET',
          `/acompanhamento-instituicao/vinculos/${id}/tarefas`,
          undefined,
          dele('admA'),
        )
      ).statusCode,
    ).toBe(403);
    // Pedagógico de outra instituição não vê nem aceita
    expect(
      (await chamar('GET', '/acompanhamento-instituicao/fila', undefined, dele('pedB'))).json()
        .pedidos,
    ).toEqual([]);
    expect(
      (
        await chamar(
          'POST',
          `/acompanhamento-instituicao/fila/${id}/aceitar`,
          undefined,
          dele('pedB'),
        )
      ).statusCode,
    ).toBe(404);
    // aceita; menor sem aprovação: nada é lido
    expect(
      (
        await chamar(
          'POST',
          `/acompanhamento-instituicao/fila/${id}/aceitar`,
          undefined,
          dele('ped1'),
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await chamar(
          'POST',
          `/acompanhamento-instituicao/fila/${id}/aceitar`,
          undefined,
          dele('ped2'),
        )
      ).statusCode,
    ).toBe(404); // já aceito
    expect(
      (
        await chamar(
          'GET',
          `/acompanhamento-instituicao/vinculos/${id}/tarefas`,
          undefined,
          dele('ped1'),
        )
      ).statusCode,
    ).toBe(403);
    // o aluno não aprova o próprio pedido; o representante aprova
    expect(
      (await chamar('POST', `/acompanhamento/${id}/aprovar`, undefined, e.cookieAluno)).statusCode,
    ).toBe(403);
    expect(
      (await chamar('POST', `/acompanhamento/${id}/aprovar`, undefined, e.cookieRep)).statusCode,
    ).toBe(200);
    const t = await chamar(
      'GET',
      `/acompanhamento-instituicao/vinculos/${id}/tarefas`,
      undefined,
      dele('ped1'),
    );
    expect(t.statusCode, t.body).toBe(200);
    expect(t.json().dados).toEqual([expect.objectContaining({ titulo: 'Tarefa de ensaio' })]);
    expect(JSON.stringify(t.json())).not.toMatch(/instituicao_id|aluno_instituicao/);
    expect(
      (
        await chamar(
          'GET',
          `/acompanhamento-instituicao/vinculos/${id}/notas`,
          undefined,
          dele('ped1'),
        )
      ).json().dados[0].disciplina,
    ).toBe('Matemática');
    // item não marcado: negado; outro Pedagógico (que não aceitou): negado
    expect(
      (
        await chamar(
          'GET',
          `/acompanhamento-instituicao/vinculos/${id}/dificuldade`,
          undefined,
          dele('ped1'),
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await chamar(
          'GET',
          `/acompanhamento-instituicao/vinculos/${id}/tarefas`,
          undefined,
          dele('ped2'),
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await chamar(
          'GET',
          `/acompanhamento-instituicao/vinculos/${id}/tarefas`,
          undefined,
          dele('pedB'),
        )
      ).statusCode,
    ).toBe(403);
    // validade pelo calendário ou 12 meses: tem data de fim
    const q = await amb.admin.query(
      "SELECT fim_em IS NOT NULL AS tem, fim_em <= current_date + interval '12 months' AS ate FROM acompanhamento WHERE id = $1",
      [id],
    );
    expect(q.rows[0]).toEqual({ tem: true, ate: true });
    // auditoria: nas duas pontas, sem o valor lido
    const aud = await amb.admin.query(
      "SELECT acao, depois::text AS depois FROM auditoria_evento WHERE acao LIKE '%leitura%' AND alvo = $1",
      [`acompanhamento:${id}`],
    );
    expect(aud.rows.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(aud.rows)).not.toMatch(/Tarefa de ensaio|Matemática/);
    // o aluno vê a instituição na própria lista
    const lista = (await chamar('GET', '/acompanhamento', undefined, e.cookieRep)).json()
      .acompanhantes as Record<string, unknown>[];
    expect(lista[0]).toMatchObject({ origem: 'codigo', email_convidado: null, situacao: 'ativo' });
    expect(lista[0]?.instituicao_nome).toBeTruthy();
    // o espaço individual não usa as rotas da instituição
    expect(
      (await chamar('GET', '/acompanhamento-instituicao/fila', undefined, e.cookieRep)).statusCode,
    ).toBe(403);
  });

  it('o representante legal pede em nome do aluno menor e nasce aprovado; recusar exige justificativa e fica registrado', async () => {
    const e = await espaco();
    const codigo = await gerarCodigo();
    const p = await chamar(
      'POST',
      '/acompanhamento/instituicao',
      { codigo, itens: NENHUMA },
      e.cookieRep,
    );
    expect(p.json().aguarda_aprovacao).toBe(false);
    const id = (
      await amb.admin.query(
        "SELECT id FROM acompanhamento WHERE instituicao_id = $1 AND origem = 'codigo'",
        [e.inst],
      )
    ).rows[0].id as string;
    expect(
      (await chamar('POST', `/acompanhamento-instituicao/fila/${id}/recusar`, {}, dele('ped1')))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await chamar(
          'POST',
          `/acompanhamento-instituicao/fila/${id}/recusar`,
          { justificativa: 'ab' },
          dele('ped1'),
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await chamar(
          'POST',
          `/acompanhamento-instituicao/fila/${id}/recusar`,
          { justificativa: 'Fora do nosso atendimento' },
          dele('ped1'),
        )
      ).statusCode,
    ).toBe(200);
    const q = await amb.admin.query(
      'SELECT situacao, encerrado_por, justificativa FROM acompanhamento WHERE id = $1',
      [id],
    );
    expect(q.rows[0]).toEqual({
      situacao: 'encerrado',
      encerrado_por: 'instituicao',
      justificativa: 'Fora do nosso atendimento',
    });
  });
});

describe('encerrar, renovar em lote e prorrogar', () => {
  it('a instituição encerra com justificativa e corta na hora; outra instituição não encerra', async () => {
    const e = await espaco();
    const id = await vinculoAtivo(e, await gerarCodigo());
    expect(
      (
        await chamar(
          'GET',
          `/acompanhamento-instituicao/vinculos/${id}/tarefas`,
          undefined,
          dele('ped1'),
        )
      ).statusCode,
    ).toBe(200);
    const lista = (
      await chamar('GET', '/acompanhamento-instituicao/vinculos', undefined, dele('admA'))
    ).json().vinculos as Record<string, unknown>[];
    expect(lista.find((v) => v.id === id)).toMatchObject({
      aluno_nome: 'Aluno Menor',
      acompanhante_nome: 'Pessoa ped1',
      situacao: 'ativo',
    });
    expect(
      (
        await chamar(
          'POST',
          `/acompanhamento-instituicao/vinculos/${id}/encerrar`,
          { justificativa: 'Teste de saída' },
          dele('pedB'),
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await chamar(
          'POST',
          `/acompanhamento-instituicao/vinculos/${id}/encerrar`,
          { justificativa: 'x' },
          dele('admA'),
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await chamar(
          'POST',
          `/acompanhamento-instituicao/vinculos/${id}/encerrar`,
          { justificativa: 'Teste de saída' },
          dele('admA'),
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await chamar(
          'GET',
          `/acompanhamento-instituicao/vinculos/${id}/tarefas`,
          undefined,
          dele('ped1'),
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (await amb.admin.query('SELECT count(*)::int AS n FROM acompanhamento WHERE id = $1', [id]))
        .rows[0].n,
    ).toBe(1); // nada se apaga
  });

  it('vencido não lê; a renovação em lote é só da própria instituição; o aluno prorroga 30 dias só perto da data', async () => {
    const e = await espaco();
    const id = await vinculoAtivo(e, await gerarCodigo());
    await amb.admin.query('UPDATE acompanhamento SET fim_em = current_date - 1 WHERE id = $1', [
      id,
    ]);
    expect(
      (
        await chamar(
          'GET',
          `/acompanhamento-instituicao/vinculos/${id}/tarefas`,
          undefined,
          dele('ped1'),
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (await chamar('GET', '/acompanhamento-instituicao/vinculos', undefined, dele('ped1')))
        .json()
        .vinculos.find((v: { id: string }) => v.id === id).vencido,
    ).toBe(true);
    // outra instituição não renova; a própria renova em lote e volta a valer
    expect(
      (
        await chamar(
          'POST',
          '/acompanhamento-instituicao/vinculos/renovar',
          { ids: [id] },
          dele('admB'),
        )
      ).json().renovados,
    ).toBe(0);
    expect(
      (
        await chamar(
          'POST',
          '/acompanhamento-instituicao/vinculos/renovar',
          { ids: [id] },
          dele('profA'),
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await chamar(
          'POST',
          '/acompanhamento-instituicao/vinculos/renovar',
          { ids: [id] },
          dele('admA'),
        )
      ).json().renovados,
    ).toBe(1);
    expect(
      (
        await chamar(
          'GET',
          `/acompanhamento-instituicao/vinculos/${id}/tarefas`,
          undefined,
          dele('ped1'),
        )
      ).statusCode,
    ).toBe(200);
    // vínculo de instituição não se renova pela rota do aluno (só prorroga)
    expect(
      (await chamar('POST', `/acompanhamento/${id}/renovar`, undefined, e.cookieRep)).statusCode,
    ).toBe(404);
    // prorrogar: longe da data, não; perto, sim (+30 dias)
    await amb.admin.query('UPDATE acompanhamento SET fim_em = current_date + 200 WHERE id = $1', [
      id,
    ]);
    expect(
      (await chamar('POST', `/acompanhamento/${id}/prorrogar`, undefined, e.cookieRep)).statusCode,
    ).toBe(409);
    await amb.admin.query('UPDATE acompanhamento SET fim_em = current_date + 10 WHERE id = $1', [
      id,
    ]);
    expect(
      (await chamar('POST', `/acompanhamento/${id}/prorrogar`, undefined, e.cookieRep)).statusCode,
    ).toBe(200);
    const q = await amb.admin.query(
      'SELECT (fim_em - current_date)::int AS dias FROM acompanhamento WHERE id = $1',
      [id],
    );
    expect(q.rows[0].dias).toBe(40);
    // prorrogar não vale para pedido por e-mail
    const p = await chamar(
      'POST',
      '/acompanhamento',
      { email: `x-${sufixo()}@l22b.exemplo`, papel: 'professor', itens: NENHUMA },
      e.cookieRep,
    );
    expect(
      (await chamar('POST', `/acompanhamento/${p.json().id}/prorrogar`, undefined, e.cookieRep))
        .statusCode,
    ).toBe(404);
  });

  it('banco: o app não lê a tabela do código nem tem política que cruze espaços', async () => {
    const r = await amb.bancoApp
      .$queryRawUnsafe('SELECT count(*)::int AS n FROM codigo_acompanhamento')
      .then((x) => x as { n: number }[]);
    expect(r[0]?.n).toBe(0); // sem contexto de instituição, a RLS não mostra nenhuma linha
  });
});
