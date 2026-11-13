import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { hashCodigo } from '../auth/codigos.js';
import type { Email } from '../auth/email.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// L22a-2 (migração 0028): acompanhamento por e-mail e "Quem pode ver meus dados". Só dados fictícios.
const SENHA = 'senha de teste longa 123';
const SENHA_ALUNO = 'senha provisoria longa 456';
const SENHA_ALUNO_NOVA = 'senha nova do aluno 789';
const TODAS = { tarefas: true, dificuldade: true, notas: true, mensagens: true };
const NENHUMA = { tarefas: false, dificuldade: false, notas: false, mensagens: false };
let amb: Ambiente;
let app: FastifyInstance;
const enviados: Email[] = [];

const chamar = (
  metodo: 'GET' | 'POST' | 'PATCH',
  url: string,
  payload?: unknown,
  cookie?: string,
) =>
  app.inject({
    method: metodo,
    url,
    payload: payload as object,
    headers: cookie ? { cookie } : {},
  });
const cookieDe = (r: { headers: Record<string, unknown> }) =>
  String(r.headers['set-cookie']).split(';')[0] as string;
const sufixo = () => randomUUID().slice(0, 8);
const tokenDoEmail = (para: string, rota: RegExp) =>
  [...enviados]
    .reverse()
    .find((x) => x.para === para && rota.test(x.texto))
    ?.texto.match(/#([A-Za-z0-9_-]+)/)?.[1] as string;

// Pessoa com conta e sessão (papel professor, pedagogico ou responsavel)
async function pessoa(
  papel: 'professor' | 'pedagogico' | 'responsavel',
  email = `p-${sufixo()}@acomp.exemplo`,
) {
  const extra = papel === 'pedagogico' ? { tipo_profissional: 'psicopedagogo' } : {};
  const c = await chamar('POST', '/auth/pessoa/cadastro', {
    nome: 'Pessoa Fictícia',
    email,
    senha: SENHA,
    papel,
    aceite: true,
    ...extra,
  });
  expect(c.statusCode, c.body).toBe(202);
  await chamar('POST', '/auth/pessoa/confirmar-email', {
    token: tokenDoEmail(email, /confirmar o seu e-mail/),
  });
  const l = await chamar('POST', '/auth/pessoa/login', { email, senha: SENHA });
  expect(l.statusCode, l.body).toBe(200);
  return { email, cookie: cookieDe(l) };
}
const convite = async () => {
  const codigo = `ABCD-${sufixo()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, 'X')}-EFGH`;
  await amb.admin.query(
    "INSERT INTO convite_individual (codigo_hash, criado_por, tipo) VALUES ($1, 'teste', 'individual')",
    [hashCodigo(codigo)],
  );
  return codigo;
};

// Espaço do aluno menor, criado pelo representante legal. Devolve as sessões do representante e do aluno, já completas.
async function espaco() {
  const rep = await pessoa('responsavel');
  const alunoEmail = `al-${sufixo()}@acomp.exemplo`;
  const r = await chamar(
    'POST',
    '/auth/pessoa/aluno-menor',
    {
      codigo: await convite(),
      aluno: {
        nome: 'Aluno Menor',
        email: alunoEmail,
        nascimento: '2015-03-10',
        senha: SENHA_ALUNO,
      },
      representante_nascimento: '1985-06-20',
      aceite: true,
    },
    rep.cookie,
  );
  expect(r.statusCode, r.body).toBe(201);
  const inst = r.json().instituicao_id as string;
  const e = await chamar('POST', '/auth/pessoa/entrar', { instituicao_id: inst }, rep.cookie);
  expect(e.statusCode, e.body).toBe(200);
  const cookieRep = cookieDe(e);
  const l1 = await chamar('POST', '/auth/login', {
    sem_instituicao: true,
    email: alunoEmail,
    senha: SENHA_ALUNO,
  });
  const t = await chamar(
    'POST',
    '/auth/senha/trocar',
    { senha_atual: SENHA_ALUNO, senha_nova: SENHA_ALUNO_NOVA },
    cookieDe(l1),
  );
  expect(t.statusCode, t.body).toBe(200);
  const l2 = await chamar('POST', '/auth/login', {
    sem_instituicao: true,
    email: alunoEmail,
    senha: SENHA_ALUNO_NOVA,
  });
  expect(l2.json().nivel).toBe('completo');
  const aluno = await amb.admin.query(
    "SELECT id FROM usuario WHERE instituicao_id = $1 AND perfil = 'aluno'",
    [inst],
  );
  return { inst, alunoId: aluno.rows[0].id as string, cookieRep, cookieAluno: cookieDe(l2) };
}
type Espaco = Awaited<ReturnType<typeof espaco>>;

const semear = async (e: Espaco) => {
  await amb.admin.query(
    "INSERT INTO tarefa (instituicao_id, usuario_id, titulo, dificuldade) VALUES ($1, $2, 'Tarefa de ensaio', 7)",
    [e.inst, e.alunoId],
  );
  await amb.admin.query(
    "INSERT INTO nota_pessoal (instituicao_id, usuario_id, disciplina, valor, dia) VALUES ($1, $2, 'Matemática', 8.5, current_date)",
    [e.inst, e.alunoId],
  );
};
// Convida pelo cookie dado e a pessoa aceita pelo link do e-mail
async function convidarEAceitar(
  cookieQuem: string,
  p: { email: string; cookie: string },
  papel: 'professor' | 'pedagogico' | 'responsavel',
  itens = NENHUMA,
) {
  const c = await chamar('POST', '/acompanhamento', { email: p.email, papel, itens }, cookieQuem);
  expect(c.statusCode, c.body).toBe(201);
  const token = tokenDoEmail(p.email, /convite para acompanhar|pediu que você o acompanhe/);
  const a = await chamar('POST', '/auth/pessoa/acompanhamento/aceitar', { token }, p.cookie);
  return {
    id: c.json().id as string,
    aprova: c.json().aguarda_aprovacao as boolean,
    token,
    aceite: a,
  };
}

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    limiteTentativasPorMinuto: 1000,
    enviarEmail: async (m) => {
      enviados.push(m);
    },
  });
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('pedido feito pelo representante legal (aluno menor)', () => {
  it('nasce aprovado; a pessoa aceita; nada marcado = nada lido; marcar libera só o marcado; cada leitura é auditada sem valor', async () => {
    const e = await espaco();
    await semear(e);
    const prof = await pessoa('professor');
    const r = await convidarEAceitar(e.cookieRep, prof, 'professor');
    expect(r.aprova).toBe(false);
    expect(r.aceite.statusCode, r.aceite.body).toBe(200);
    // a pessoa vê o aluno acompanhado e o aviso de quem controla o acesso; validade de 12 meses
    const lista = (await chamar('GET', '/auth/pessoa/acompanhando', undefined, prof.cookie)).json()
      .alunos;
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      papel: 'professor',
      situacao: 'ativo',
      aviso_pendente: true,
      ver_tarefas: false,
    });
    expect(lista[0].fim_em).not.toBeNull();
    expect(Object.keys(lista[0])).not.toContain('instituicao_id'); // nada de identificador interno do espaço
    // padrão: nada marcado = nada lido
    for (const item of ['tarefas', 'dificuldade', 'notas', 'mensagens'])
      expect(
        (await chamar('GET', `/auth/pessoa/acompanhando/${r.id}/${item}`, undefined, prof.cookie))
          .statusCode,
      ).toBe(403);
    // o representante libera só tarefas e notas
    const p = await chamar(
      'PATCH',
      `/acompanhamento/${r.id}/itens`,
      { ...NENHUMA, tarefas: true, notas: true },
      e.cookieRep,
    );
    expect(p.statusCode, p.body).toBe(200);
    const t = await chamar(
      'GET',
      `/auth/pessoa/acompanhando/${r.id}/tarefas`,
      undefined,
      prof.cookie,
    );
    expect(t.statusCode, t.body).toBe(200);
    expect(t.json().dados).toEqual([expect.objectContaining({ titulo: 'Tarefa de ensaio' })]);
    expect(
      (
        await chamar('GET', `/auth/pessoa/acompanhando/${r.id}/notas`, undefined, prof.cookie)
      ).json().dados[0].disciplina,
    ).toBe('Matemática');
    expect(
      (await chamar('GET', `/auth/pessoa/acompanhando/${r.id}/dificuldade`, undefined, prof.cookie))
        .statusCode,
    ).toBe(403);
    expect(
      (await chamar('GET', `/auth/pessoa/acompanhando/${r.id}/mensagens`, undefined, prof.cookie))
        .statusCode,
    ).toBe(403);
    // auditoria: a leitura fica registrada, sem o valor lido
    const aud = await amb.admin.query(
      "SELECT alvo, depois::text AS depois FROM auditoria_evento WHERE instituicao_id = $1 AND acao = 'acompanhamento.leitura'",
      [e.inst],
    );
    expect(aud.rows.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(aud.rows)).not.toMatch(/Tarefa de ensaio|Matemática/);
    // a mudança das caixas faz o aviso voltar; ler o aviso o tira
    expect(
      (await chamar('GET', '/auth/pessoa/acompanhando', undefined, prof.cookie)).json().alunos[0]
        .aviso_pendente,
    ).toBe(true);
    expect(
      (await chamar('POST', `/auth/pessoa/acompanhando/${r.id}/aviso`, undefined, prof.cookie))
        .statusCode,
    ).toBe(204);
    expect(
      (await chamar('GET', '/auth/pessoa/acompanhando', undefined, prof.cookie)).json().alunos[0]
        .aviso_pendente,
    ).toBe(false);
  });
});

describe('pedido feito pelo aluno menor', () => {
  it('só vale depois que o representante aprova; antes disso nada é liberado', async () => {
    const e = await espaco();
    await semear(e);
    const ped = await pessoa('pedagogico');
    const r = await convidarEAceitar(e.cookieAluno, ped, 'pedagogico', TODAS);
    expect(r.aprova).toBe(true);
    expect(r.aceite.statusCode, r.aceite.body).toBe(200);
    const lista = (await chamar('GET', '/auth/pessoa/acompanhando', undefined, ped.cookie)).json()
      .alunos;
    expect(lista[0].situacao).toBe('aguardando_representante');
    expect(
      (await chamar('GET', `/auth/pessoa/acompanhando/${r.id}/tarefas`, undefined, ped.cookie))
        .statusCode,
    ).toBe(403);
    // o aluno não aprova o próprio pedido; o representante aprova
    expect(
      (await chamar('POST', `/acompanhamento/${r.id}/aprovar`, undefined, e.cookieAluno))
        .statusCode,
    ).toBe(403);
    expect(
      (await chamar('POST', `/acompanhamento/${r.id}/aprovar`, undefined, e.cookieRep)).statusCode,
    ).toBe(200);
    expect(
      (await chamar('GET', `/auth/pessoa/acompanhando/${r.id}/tarefas`, undefined, ped.cookie))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await chamar('GET', `/auth/pessoa/acompanhando/${r.id}/dificuldade`, undefined, ped.cookie)
      ).json().dados,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nome: 'Tarefa de ensaio', dificuldade: 7 }),
      ]),
    );
  });

  it('aprovar antes de a pessoa aceitar também funciona (a ordem não importa)', async () => {
    const e = await espaco();
    const prof = await pessoa('professor');
    const c = await chamar(
      'POST',
      '/acompanhamento',
      { email: prof.email, papel: 'professor', itens: TODAS },
      e.cookieAluno,
    );
    expect(c.statusCode).toBe(201);
    expect(
      (await chamar('POST', `/acompanhamento/${c.json().id}/aprovar`, undefined, e.cookieRep))
        .statusCode,
    ).toBe(200);
    const token = tokenDoEmail(prof.email, /pediu que você o acompanhe/);
    expect(
      (await chamar('POST', '/auth/pessoa/acompanhamento/aceitar', { token }, prof.cookie))
        .statusCode,
    ).toBe(200);
    expect(
      (await chamar('GET', '/auth/pessoa/acompanhando', undefined, prof.cookie)).json().alunos[0]
        .situacao,
    ).toBe('ativo');
  });
});

describe('encerrar, vencer, renovar e limite', () => {
  it('encerrar exige justificativa, registra quem e corta o acesso na hora; vencido não lê', async () => {
    const e = await espaco();
    await semear(e);
    const prof = await pessoa('professor');
    const r = await convidarEAceitar(e.cookieRep, prof, 'professor', TODAS);
    expect(
      (await chamar('GET', `/auth/pessoa/acompanhando/${r.id}/tarefas`, undefined, prof.cookie))
        .statusCode,
    ).toBe(200);
    // vencido: não lê
    await amb.admin.query('UPDATE acompanhamento SET fim_em = current_date - 1 WHERE id = $1', [
      r.id,
    ]);
    expect(
      (await chamar('GET', `/auth/pessoa/acompanhando/${r.id}/tarefas`, undefined, prof.cookie))
        .statusCode,
    ).toBe(403);
    expect(
      (await chamar('GET', '/auth/pessoa/acompanhando', undefined, prof.cookie)).json().alunos[0]
        .vencido,
    ).toBe(true);
    // o representante renova (o aluno menor não) e volta a valer
    expect(
      (await chamar('POST', `/acompanhamento/${r.id}/renovar`, undefined, e.cookieAluno))
        .statusCode,
    ).toBe(403);
    expect(
      (await chamar('POST', `/acompanhamento/${r.id}/renovar`, undefined, e.cookieRep)).statusCode,
    ).toBe(200);
    expect(
      (await chamar('GET', `/auth/pessoa/acompanhando/${r.id}/tarefas`, undefined, prof.cookie))
        .statusCode,
    ).toBe(200);
    // sem justificativa não encerra; com justificativa, encerra e corta na hora
    expect(
      (await chamar('POST', `/acompanhamento/${r.id}/encerrar`, {}, e.cookieAluno)).statusCode,
    ).toBe(400);
    expect(
      (
        await chamar(
          'POST',
          `/acompanhamento/${r.id}/encerrar`,
          { justificativa: 'ab' },
          e.cookieAluno,
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await chamar(
          'POST',
          `/acompanhamento/${r.id}/encerrar`,
          { justificativa: 'Mudou de escola' },
          e.cookieAluno,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await chamar('GET', `/auth/pessoa/acompanhando/${r.id}/tarefas`, undefined, prof.cookie))
        .statusCode,
    ).toBe(403);
    const q = await amb.admin.query(
      'SELECT situacao, encerrado_por, justificativa FROM acompanhamento WHERE id = $1',
      [r.id],
    );
    expect(q.rows[0]).toEqual({
      situacao: 'encerrado',
      encerrado_por: 'aluno',
      justificativa: 'Mudou de escola',
    });
    // nada se apaga
    expect(
      (await amb.admin.query('SELECT count(*)::int AS n FROM acompanhamento WHERE id = $1', [r.id]))
        .rows[0].n,
    ).toBe(1);
  });

  it('limite de 5 pedidos abertos; encerrar um libera vaga', async () => {
    const e = await espaco();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const c = await chamar(
        'POST',
        '/acompanhamento',
        { email: `l${i}-${sufixo()}@acomp.exemplo`, papel: 'professor', itens: NENHUMA },
        e.cookieRep,
      );
      expect(c.statusCode, c.body).toBe(201);
      ids.push(c.json().id);
    }
    const sexto = await chamar(
      'POST',
      '/acompanhamento',
      { email: `l6-${sufixo()}@acomp.exemplo`, papel: 'professor', itens: NENHUMA },
      e.cookieRep,
    );
    expect(sexto.statusCode).toBe(409);
    await chamar(
      'POST',
      `/acompanhamento/${ids[0]}/encerrar`,
      { justificativa: 'Teste de vaga' },
      e.cookieRep,
    );
    expect(
      (
        await chamar(
          'POST',
          '/acompanhamento',
          { email: `l7-${sufixo()}@acomp.exemplo`, papel: 'professor', itens: NENHUMA },
          e.cookieRep,
        )
      ).statusCode,
    ).toBe(201);
  });
});

describe('aluno maior e representante indicado', () => {
  it('o aluno maior indica um representante sem aprovação; o representante legal deixa de gerenciar', async () => {
    const e = await espaco();
    await amb.admin.query(
      "UPDATE aluno_dados SET nascimento = DATE '2000-01-01' WHERE instituicao_id = $1 AND usuario_id = $2",
      [e.inst, e.alunoId],
    );
    const ind = await pessoa('responsavel');
    const r = await convidarEAceitar(e.cookieAluno, ind, 'responsavel', {
      ...NENHUMA,
      tarefas: true,
    });
    expect(r.aprova).toBe(false);
    expect(r.aceite.statusCode, r.aceite.body).toBe(200);
    const q = await amb.admin.query('SELECT situacao, fim_em FROM acompanhamento WHERE id = $1', [
      r.id,
    ]);
    expect(q.rows[0]).toEqual({ situacao: 'ativo', fim_em: null }); // o indicado não vence
    expect(
      (await chamar('GET', `/auth/pessoa/acompanhando/${r.id}/tarefas`, undefined, ind.cookie))
        .statusCode,
    ).toBe(200);
    // aluno maior: o representante legal não gerencia nem encerra; o aluno encerra
    expect(
      (await chamar('PATCH', `/acompanhamento/${r.id}/itens`, TODAS, e.cookieRep)).statusCode,
    ).toBe(403);
    expect(
      (
        await chamar(
          'POST',
          `/acompanhamento/${r.id}/encerrar`,
          { justificativa: 'Teste de saída' },
          e.cookieRep,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await chamar(
          'POST',
          `/acompanhamento/${r.id}/encerrar`,
          { justificativa: 'Teste de saída' },
          e.cookieAluno,
        )
      ).statusCode,
    ).toBe(200);
  });

  it('aluno menor e representante legal não indicam representante', async () => {
    const e = await espaco();
    const alvo = { email: `ind-${sufixo()}@acomp.exemplo`, papel: 'responsavel', itens: NENHUMA };
    expect((await chamar('POST', '/acompanhamento', alvo, e.cookieAluno)).statusCode).toBe(403);
    expect((await chamar('POST', '/acompanhamento', alvo, e.cookieRep)).statusCode).toBe(403);
  });
});

describe('segurança do link e do acesso', () => {
  it('link de uso único, só para o e-mail convidado e para o papel certo; pedido não nasce de quem está de fora', async () => {
    const e = await espaco();
    const prof = await pessoa('professor');
    const outro = await pessoa('professor');
    const c = await chamar(
      'POST',
      '/acompanhamento',
      { email: prof.email, papel: 'professor', itens: NENHUMA },
      e.cookieRep,
    );
    const token = tokenDoEmail(prof.email, /pediu que você o acompanhe/);
    // outra conta com o link: recusa (e-mail diferente)
    expect(
      (await chamar('POST', '/auth/pessoa/acompanhamento/aceitar', { token }, outro.cookie))
        .statusCode,
    ).toBe(400);
    // aceita; segundo uso do mesmo link não vale
    expect(
      (await chamar('POST', '/auth/pessoa/acompanhamento/aceitar', { token }, prof.cookie))
        .statusCode,
    ).toBe(200);
    expect(
      (await chamar('POST', '/auth/pessoa/acompanhamento/aceitar', { token }, prof.cookie))
        .statusCode,
    ).toBe(400);
    // a pessoa de fora não cria pedido, não encerra e não lê pedido alheio
    expect(
      (
        await chamar(
          'POST',
          '/acompanhamento',
          { email: prof.email, papel: 'professor', itens: TODAS },
          prof.cookie,
        )
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await chamar(
          'GET',
          `/auth/pessoa/acompanhando/${c.json().id}/tarefas`,
          undefined,
          outro.cookie,
        )
      ).statusCode,
    ).toBe(403);
    // sem sessão
    expect((await chamar('GET', '/acompanhamento')).statusCode).toBe(401);
    expect((await chamar('GET', '/auth/pessoa/acompanhando')).statusCode).toBe(401);
  });

  it('papel diferente do convite é recusado com aviso claro', async () => {
    const e = await espaco();
    const ped = await pessoa('pedagogico');
    await chamar(
      'POST',
      '/acompanhamento',
      { email: ped.email, papel: 'professor', itens: NENHUMA },
      e.cookieRep,
    );
    const token = tokenDoEmail(ped.email, /pediu que você o acompanhe/);
    expect(
      (await chamar('POST', '/auth/pessoa/acompanhamento/aceitar', { token }, ped.cookie))
        .statusCode,
    ).toBe(409);
  });

  it('isolamento: o acompanhante de um aluno não lê outro aluno, e o aluno só vê a própria lista', async () => {
    const a = await espaco();
    const b = await espaco();
    await semear(b);
    const prof = await pessoa('professor');
    const ra = await convidarEAceitar(a.cookieRep, prof, 'professor', TODAS);
    const rb = await chamar(
      'POST',
      '/acompanhamento',
      { email: `x-${sufixo()}@acomp.exemplo`, papel: 'professor', itens: TODAS },
      b.cookieRep,
    );
    expect(
      (
        await chamar(
          'GET',
          `/auth/pessoa/acompanhando/${rb.json().id}/tarefas`,
          undefined,
          prof.cookie,
        )
      ).statusCode,
    ).toBe(403);
    const dados = (
      await chamar('GET', `/auth/pessoa/acompanhando/${ra.id}/tarefas`, undefined, prof.cookie)
    ).json().dados;
    expect(dados).toEqual([]); // o espaço de A não tem as tarefas de B
    // a lista de B não mostra o pedido de A
    const lb = (await chamar('GET', '/acompanhamento', undefined, b.cookieRep)).json()
      .acompanhantes;
    expect(lb.map((x: { id: string }) => x.id)).toEqual([rb.json().id]);
    // o aluno não mexe em pedido de outro espaço
    expect(
      (
        await chamar(
          'POST',
          `/acompanhamento/${ra.id}/encerrar`,
          { justificativa: 'Tentativa' },
          b.cookieRep,
        )
      ).statusCode,
    ).toBe(404);
  });

  it('o banco impede o app de ler a tabela de links; o representante legal lista os pedidos do aluno', async () => {
    const e = await espaco();
    const r = await amb.bancoApp
      .$queryRawUnsafe('SELECT 1 FROM convite_acompanhamento LIMIT 1')
      .then(
        () => 'leu',
        (x: unknown) => String(x),
      );
    expect(r).toMatch(/permission denied/);
    expect((await chamar('GET', '/acompanhamento', undefined, e.cookieRep)).statusCode).toBe(200);
  });
});
