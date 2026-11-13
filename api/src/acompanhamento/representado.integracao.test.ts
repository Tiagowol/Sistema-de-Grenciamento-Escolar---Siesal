import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { hashCodigo } from '../auth/codigos.js';
import type { Email } from '../auth/email.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// L22a-3 (migração 0030): "Meu aluno" (representante legal vê tudo do aluno menor, só leitura) e seção "Aluno menor" só do
// representante legal. Só dados fictícios.
const SENHA = 'senha de teste longa 123';
const SENHA_ALUNO = 'senha provisoria longa 456';
const ITENS = ['tarefas', 'agenda', 'notas', 'mensagens', 'disciplinas', 'dificuldade'] as const;
let amb: Ambiente;
let app: FastifyInstance;
const enviados: Email[] = [];

const chamar = (
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
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

async function pessoa(papel: 'professor' | 'pedagogico' | 'responsavel') {
  const email = `p-${sufixo()}@repr.exemplo`;
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
// O representante legal (já com conta) cria um aluno menor e entra no espaço dele
async function novoAluno(rep: { cookie: string }, nome = 'Aluno Menor') {
  const alunoEmail = `al-${sufixo()}@repr.exemplo`;
  const r = await chamar(
    'POST',
    '/auth/pessoa/aluno-menor',
    {
      codigo: await convite(),
      aluno: { nome, email: alunoEmail, nascimento: '2015-03-10', senha: SENHA_ALUNO },
      representante_nascimento: '1985-06-20',
      aceite: true,
    },
    rep.cookie,
  );
  expect(r.statusCode, r.body).toBe(201);
  const inst = r.json().instituicao_id as string;
  const e = await chamar('POST', '/auth/pessoa/entrar', { instituicao_id: inst }, rep.cookie);
  expect(e.statusCode, e.body).toBe(200);
  const al = await amb.admin.query(
    "SELECT id FROM usuario WHERE instituicao_id = $1 AND perfil = 'aluno'",
    [inst],
  );
  return { inst, alunoId: al.rows[0].id as string, cookieRep: cookieDe(e), alunoEmail };
}
type Espaco = Awaited<ReturnType<typeof novoAluno>>;

const semear = async (e: Espaco, titulo: string) => {
  const q = (sql: string, extra: unknown[] = []) =>
    amb.admin.query(sql, [e.inst, e.alunoId, ...extra]);
  await q(
    'INSERT INTO tarefa (instituicao_id, usuario_id, titulo, prazo, dificuldade) VALUES ($1, $2, $3, current_date + 1, 7)',
    [titulo],
  );
  await q(
    "INSERT INTO evento (instituicao_id, usuario_id, titulo, tipo, dia, hora_inicio, minutos) VALUES ($1, $2, $3, 'estudo', current_date, '14:30', 25)",
    [`Estudo de ${titulo}`],
  );
  await q(
    "INSERT INTO nota_pessoal (instituicao_id, usuario_id, disciplina, valor, dia) VALUES ($1, $2, 'Matemática', 8.5, current_date)",
  );
  await q(
    "INSERT INTO disciplina_aluno (instituicao_id, usuario_id, nome, origem, dificuldade) VALUES ($1, $2, 'Geografia', 'propria', 4)",
  );
  await q(
    "INSERT INTO pedido_ajuda (instituicao_id, aluno_id, destino, motivo, texto) VALUES ($1, $2, 'pedagogico', 'nao_entendi', 'Não entendi a conta')",
  );
};
async function espaco(titulo = 'Tarefa de ensaio'): Promise<Espaco> {
  const e = await novoAluno(await pessoa('responsavel'));
  await semear(e, titulo);
  return e;
}
const nascimento = (e: Espaco, sql: string) =>
  amb.admin.query(
    `UPDATE aluno_dados SET nascimento = ${sql} WHERE instituicao_id = $1 AND usuario_id = $2`,
    [e.inst, e.alunoId],
  );
const titulos = (r: { json: () => { dados: { titulo: string }[] } }) =>
  r.json().dados.map((t) => t.titulo);

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

describe('"Meu aluno": o representante legal lê tudo do aluno menor', () => {
  it('lê os 6 itens do próprio aluno, um por vez, e a ficha diz que o aluno é menor', async () => {
    const e = await espaco();
    const f = await chamar('GET', '/representado', undefined, e.cookieRep);
    expect(f.statusCode, f.body).toBe(200);
    expect(f.json()).toMatchObject({ aluno_nome: 'Aluno Menor', menor: true });
    expect(f.json().dias_para_18).toBeGreaterThan(30);
    const dados: Record<string, Record<string, unknown>[]> = {};
    for (const item of ITENS) {
      const r = await chamar('GET', `/representado/${item}`, undefined, e.cookieRep);
      expect(r.statusCode, `${item}: ${r.body}`).toBe(200);
      expect(r.json().item).toBe(item);
      dados[item] = r.json().dados;
    }
    expect(dados.tarefas).toEqual([expect.objectContaining({ titulo: 'Tarefa de ensaio' })]);
    expect(dados.agenda).toEqual([
      expect.objectContaining({
        titulo: 'Estudo de Tarefa de ensaio',
        hora_inicio: '14:30',
        minutos: 25,
      }),
    ]);
    expect(dados.notas?.[0]?.disciplina).toBe('Matemática');
    expect(dados.mensagens?.[0]?.texto).toBe('Não entendi a conta');
    expect(dados.disciplinas).toEqual([expect.objectContaining({ nome: 'Geografia' })]);
    expect(dados.dificuldade).toHaveLength(2); // a tarefa (7) e a disciplina (4)
  });

  it('item desconhecido é 400; sem sessão é 401', async () => {
    const e = await espaco();
    expect((await chamar('GET', '/representado/tudo', undefined, e.cookieRep)).statusCode).toBe(
      400,
    );
    expect((await chamar('GET', '/representado/tarefas')).statusCode).toBe(401);
  });

  it('isolamento: em cada espaço o representante lê só o aluno daquele espaço', async () => {
    const rep = await pessoa('responsavel');
    const a = await novoAluno(rep, 'Aluno A');
    const b = await novoAluno(rep, 'Aluno B');
    await semear(a, 'Só do A');
    await semear(b, 'Só do B');
    expect(titulos(await chamar('GET', '/representado/tarefas', undefined, a.cookieRep))).toEqual([
      'Só do A',
    ]);
    expect(titulos(await chamar('GET', '/representado/tarefas', undefined, b.cookieRep))).toEqual([
      'Só do B',
    ]);
    expect((await chamar('GET', '/representado', undefined, a.cookieRep)).json().aluno_nome).toBe(
      'Aluno A',
    );
  });

  it('quem não é o representante legal não passa: pessoa sem espaço, e o representante de outro espaço só lê o aluno dele', async () => {
    const e = await espaco();
    const outro = await espaco('Tarefa de outro');
    expect(
      titulos(await chamar('GET', '/representado/tarefas', undefined, outro.cookieRep)),
    ).toEqual(['Tarefa de outro']);
    // o cookie da pessoa (fora de um espaço) não abre esta porta
    const prof = await pessoa('professor');
    expect((await chamar('GET', '/representado/tarefas', undefined, prof.cookie)).statusCode).toBe(
      401,
    );
    // o vínculo legal desativado corta o acesso na hora
    await amb.admin.query(
      "UPDATE vinculo SET desativado_em = now() WHERE instituicao_id = $1 AND tipo = 'responsavel_aluno'",
      [e.inst],
    );
    expect((await chamar('GET', '/representado/tarefas', undefined, e.cookieRep)).statusCode).toBe(
      403,
    );
    expect((await chamar('GET', '/representado', undefined, e.cookieRep)).statusCode).toBe(403);
  });

  it('só leitura: nenhuma rota de escrita em /representado, e o representante não escreve nas rotas do aluno', async () => {
    const e = await espaco();
    for (const m of ['POST', 'PATCH', 'PUT', 'DELETE'] as const)
      for (const url of ['/representado', '/representado/tarefas'])
        expect((await chamar(m, url, {}, e.cookieRep)).statusCode, `${m} ${url}`).toBe(404);
    const conta = async () =>
      (
        await amb.admin.query(
          'SELECT (SELECT count(*) FROM tarefa WHERE instituicao_id = $1)::int AS t, (SELECT count(*) FROM evento WHERE instituicao_id = $1)::int AS e, (SELECT count(*) FROM nota_pessoal WHERE instituicao_id = $1)::int AS n, (SELECT count(*) FROM pedido_ajuda WHERE instituicao_id = $1)::int AS p',
          [e.inst],
        )
      ).rows[0];
    const antes = await conta();
    for (const [m, url, corpo] of [
      ['POST', '/tarefas', { titulo: 'Intrusa' }],
      ['POST', '/eventos', { titulo: 'Intruso', tipo: 'pessoal', dia: '2030-01-01' }],
      ['POST', '/notas-pessoais', { disciplina: 'X', valor: 5, dia: '2030-01-01' }],
      ['POST', '/ajuda', { destino: 'professor', motivo: 'outro', texto: 'x' }],
    ] as const) {
      const r = await chamar(m, url, corpo, e.cookieRep);
      expect([401, 403, 404], `${m} ${url} -> ${r.statusCode}`).toContain(r.statusCode);
    }
    expect(await conta()).toEqual(antes);
  });

  it('cada leitura é auditada com o item e sem o valor', async () => {
    const e = await espaco('Valor secreto de ensaio');
    await chamar('GET', '/representado/tarefas', undefined, e.cookieRep);
    await chamar('GET', '/representado/mensagens', undefined, e.cookieRep);
    const q = await amb.admin.query(
      "SELECT depois::text AS depois FROM auditoria_evento WHERE acao = 'representado.leitura' AND instituicao_id = $1 ORDER BY seq",
      [e.inst],
    );
    expect(q.rows.map((x) => JSON.parse(x.depois).item)).toEqual(['tarefas', 'mensagens']);
    for (const x of q.rows) {
      expect(x.depois).not.toContain('Valor secreto');
      expect(x.depois).not.toContain('Não entendi');
    }
  });
});

describe('aos 18 anos o representante legal deixa de ler tudo', () => {
  it('no dia em que o aluno completa 18 anos o acesso cai; um dia antes ainda vale', async () => {
    const e = await espaco();
    // um dia antes dos 18: ainda menor
    await nascimento(e, "((current_date - interval '18 years')::date + 1)");
    const antes = await chamar('GET', '/representado/tarefas', undefined, e.cookieRep);
    expect(antes.statusCode, antes.body).toBe(200);
    expect((await chamar('GET', '/representado', undefined, e.cookieRep)).json()).toMatchObject({
      menor: true,
      dias_para_18: 1,
    });
    // no dia dos 18: maior
    await nascimento(e, "(current_date - interval '18 years')::date");
    const f = (await chamar('GET', '/representado', undefined, e.cookieRep)).json();
    expect(f.menor).toBe(false);
    for (const item of ITENS) {
      const r = await chamar('GET', `/representado/${item}`, undefined, e.cookieRep);
      expect(r.statusCode, item).toBe(403);
      expect(r.json().maior).toBe(true);
      expect(r.body).not.toContain('Tarefa de ensaio');
    }
  });
});

describe('Agenda e Disciplinas seguem a caixa "Tarefas e plano" para quem acompanha (0030)', () => {
  it('sem a caixa: negado; com a caixa: lê agenda e disciplinas; encerrar corta na hora', async () => {
    const e = await espaco();
    const prof = await pessoa('professor');
    const nenhuma = { tarefas: false, dificuldade: false, notas: false, mensagens: false };
    const c = await chamar(
      'POST',
      '/acompanhamento',
      { email: prof.email, papel: 'professor', itens: nenhuma },
      e.cookieRep,
    );
    expect(c.statusCode, c.body).toBe(201);
    const token = tokenDoEmail(prof.email, /pediu que você o acompanhe/);
    await chamar('POST', '/auth/pessoa/acompanhamento/aceitar', { token }, prof.cookie);
    const id = c.json().id as string;
    const ler = (item: string) =>
      chamar('GET', `/auth/pessoa/acompanhando/${id}/${item}`, undefined, prof.cookie);
    for (const item of ['agenda', 'disciplinas'])
      expect((await ler(item)).statusCode, item).toBe(403);
    // só notas marcadas: agenda e disciplinas continuam negadas
    await chamar('PATCH', `/acompanhamento/${id}/itens`, { ...nenhuma, notas: true }, e.cookieRep);
    for (const item of ['agenda', 'disciplinas'])
      expect((await ler(item)).statusCode, item).toBe(403);
    // caixa "Tarefas e plano" marcada: agenda e disciplinas liberadas; notas seguem negadas
    await chamar(
      'PATCH',
      `/acompanhamento/${id}/itens`,
      { ...nenhuma, tarefas: true },
      e.cookieRep,
    );
    const ag = await ler('agenda');
    expect(ag.statusCode, ag.body).toBe(200);
    expect(ag.json().dados[0].titulo).toBe('Estudo de Tarefa de ensaio');
    expect((await ler('disciplinas')).json().dados[0].nome).toBe('Geografia');
    expect((await ler('notas')).statusCode).toBe(403);
    const enc = await chamar(
      'POST',
      `/acompanhamento/${id}/encerrar`,
      { justificativa: 'Fim do ensaio' },
      e.cookieRep,
    );
    expect(enc.statusCode, enc.body).toBe(200);
    expect((await ler('agenda')).statusCode).toBe(403);
  });
});

describe('seção "Aluno menor de idade" só para quem se cadastrou como representante legal (A-090)', () => {
  it('o representante recebe "representante" em /eu; professor e pedagógico não', async () => {
    const rep = await pessoa('responsavel');
    const prof = await pessoa('professor');
    const ped = await pessoa('pedagogico');
    expect(
      (await chamar('GET', '/auth/pessoa/eu', undefined, rep.cookie)).json().representante,
    ).toEqual({ alunos: 0, limite: 5 });
    for (const p of [prof, ped])
      expect(
        Object.keys((await chamar('GET', '/auth/pessoa/eu', undefined, p.cookie)).json()),
      ).not.toContain('representante');
  });

  it('professor e pedagógico não criam aluno menor (403) e nada é criado; o representante cria', async () => {
    const total = async () =>
      (
        await amb.admin.query(
          "SELECT count(*)::int AS n FROM instituicao WHERE tipo = 'individual'",
        )
      ).rows[0].n as number;
    const antes = await total();
    for (const papel of ['professor', 'pedagogico'] as const) {
      const p = await pessoa(papel);
      const r = await chamar(
        'POST',
        '/auth/pessoa/aluno-menor',
        {
          codigo: await convite(),
          aluno: {
            nome: 'Aluno X',
            email: `x-${sufixo()}@repr.exemplo`,
            nascimento: '2015-03-10',
            senha: SENHA_ALUNO,
          },
          representante_nascimento: '1985-06-20',
          aceite: true,
        },
        p.cookie,
      );
      expect(r.statusCode, r.body).toBe(403);
    }
    expect(await total()).toBe(antes);
    await novoAluno(await pessoa('responsavel'));
    expect(await total()).toBe(antes + 1);
  });
});
