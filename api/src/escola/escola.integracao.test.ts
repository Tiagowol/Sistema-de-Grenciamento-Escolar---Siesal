import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { verificarCadeia } from '../auditoria/auditoria.js';
import { hashSenha } from '../auth/senha.js';
import { base32Decodificar, codigoTotp, passoDe } from '../auth/totp.js';
import { withTenant } from '../banco/withTenant.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// Admin institucional (L19, migração 0016): calendário da escola, regras de notas e identidade. Só dados fictícios.
const SENHA = 'senha de teste longa 123';
const AGORA = new Date('2026-11-10T12:00:00Z');
let amb: Ambiente;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
const ids: Record<string, string> = {};
let turma = '';
let turmaB = '';
let disc = '';

const chamar = (metodo: 'GET' | 'POST', url: string, quem?: string, payload?: unknown) =>
  app.inject({
    method: metodo,
    url,
    payload: payload as object,
    headers: quem ? { cookie: cookies[quem] as string } : {},
  });

async function criar(inst: string, perfil: string, apelido: string) {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@l19.exemplo`;
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
  // O Admin configura o segundo fator antes de usar o sistema
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
      payload: { codigo: codigoTotp(base32Decodificar(ini.json().segredo), passoDe(AGORA)) },
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
  t: string | null,
  d: string | null,
  aluno: string | null,
) =>
  amb.admin.query(
    'INSERT INTO vinculo (instituicao_id, tipo, usuario_id, turma_id, disciplina_id, aluno_id) VALUES ($1,$2,$3,$4,$5,$6)',
    [inst, tipo, usuario, t, d, aluno],
  );

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => AGORA,
    limiteTentativasPorMinuto: 1000,
  });
  for (const [inst, perfil, nome] of [
    [amb.instA, 'admin', 'admin'],
    [amb.instA, 'pedagogico', 'ped'],
    [amb.instA, 'professor', 'prof'],
    [amb.instA, 'responsavel', 'resp'],
    [amb.instA, 'aluno', 'aluno1'],
    [amb.instA, 'aluno', 'aluno2'],
    [amb.instB, 'admin', 'adminB'],
  ] as const)
    await criar(inst, perfil, nome);
  const q = async (sql: string, p: unknown[]) =>
    (await amb.admin.query(sql, p)).rows[0].id as string;
  turma = await q(
    "INSERT INTO turma (instituicao_id, nome, ano_letivo, turno) VALUES ($1, 'Turma L19 7º A', 2026, 'manha') RETURNING id",
    [amb.instA],
  );
  turmaB = await q(
    "INSERT INTO turma (instituicao_id, nome, ano_letivo, turno) VALUES ($1, 'Turma B', 2026, 'manha') RETURNING id",
    [amb.instB],
  );
  disc = await q(
    "INSERT INTO disciplina (instituicao_id, nome) VALUES ($1, 'Matemática (L19)') RETURNING id",
    [amb.instA],
  );
  await vincular(amb.instA, 'professor_turma', ids.prof as string, turma, disc, null);
  await vincular(amb.instA, 'aluno_turma', ids.aluno1 as string, turma, null, null);
  await vincular(
    amb.instA,
    'responsavel_aluno',
    ids.resp as string,
    null,
    null,
    ids.aluno1 as string,
  );
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

const ITEM = (extra: object = {}) => ({
  tipo: 'feriado',
  titulo: 'Feriado municipal',
  dia_inicio: '2026-11-20',
  dia_fim: '2026-11-21',
  turma_id: null,
  ...extra,
});
const eventosDo = async (quem: string, de = '2026-11-01', ate = '2026-12-31') =>
  (await chamar('GET', `/eventos?de=${de}&ate=${ate}`, quem)).json().eventos as {
    titulo: string;
    dia: string;
    origem: string;
    tipo: string;
    item_id?: string;
  }[];
const itensDo = async (quem: string) =>
  (await chamar('GET', '/escola/calendario?de=2026-01-01&ate=2026-12-31', quem)).json().itens as {
    id: string;
    titulo: string;
  }[];
const ids19: Record<string, string> = {};

describe('L19 item 1: calendário da escola', () => {
  it('sem sessão 401; só o Admin cria, edita e desativa (negação auditada)', async () => {
    expect(
      (await chamar('GET', '/escola/calendario?de=2026-01-01&ate=2026-12-31')).statusCode,
    ).toBe(401);
    for (const quem of ['ped', 'prof', 'resp', 'aluno1'])
      expect((await chamar('POST', '/escola/calendario', quem, ITEM())).statusCode, quem).toBe(403);
    const n = await amb.admin.query(
      "SELECT count(*)::int AS n FROM auditoria_evento WHERE acao = 'escola.acesso_negado'",
    );
    expect(n.rows[0].n).toBeGreaterThanOrEqual(4);
  });

  it('recusa dados inválidos: fim antes do início, link, turma de outra escola, campo a mais', async () => {
    for (const ruim of [
      ITEM({ dia_fim: '2026-11-19' }),
      ITEM({ titulo: 'veja https://x.exemplo' }),
      ITEM({ turma_id: turmaB }),
      ITEM({ extra: 1 }),
      ITEM({ tipo: 'festa' }),
    ])
      expect((await chamar('POST', '/escola/calendario', 'admin', ruim)).statusCode).toBe(400);
  });

  it('o Admin cria itens da escola toda e da turma', async () => {
    const criar = async (nome: string, corpo: object) => {
      const r = await chamar('POST', '/escola/calendario', 'admin', corpo);
      expect(r.statusCode, nome).toBe(201);
      ids19[nome] = r.json().id;
    };
    await criar('feriado', ITEM());
    await criar('periodo', {
      tipo: 'periodo_letivo',
      titulo: '4º bimestre',
      dia_inicio: '2026-10-01',
      dia_fim: '2026-12-15',
      turma_id: null,
    });
    await criar('turma', {
      tipo: 'evento',
      titulo: 'Visita ao museu',
      dia_inicio: '2026-11-25',
      dia_fim: '2026-11-25',
      turma_id: turma,
    });
  });

  it('o aluno da turma vê tudo no próprio Calendário, com origem calendario_escolar', async () => {
    const ev = await eventosDo('aluno1');
    const escola = ev.filter((e) => e.origem === 'calendario_escolar');
    expect(escola.map((e) => `${e.dia} ${e.titulo}`)).toEqual([
      '2026-11-20 Feriado municipal',
      '2026-11-21 Feriado municipal',
      '2026-11-25 Visita ao museu',
      '2026-12-15 Termina: 4º bimestre',
    ]);
    // O começo do período (01/10) aparece quando a consulta inclui o dia
    expect((await eventosDo('aluno1', '2026-10-01', '2026-10-01')).map((e) => e.titulo)).toEqual([
      'Começa: 4º bimestre',
    ]);
  });

  it('o aluno de fora da turma não vê o evento da turma; responsável vê pelo filho; professor pela turma', async () => {
    expect((await eventosDo('aluno2')).some((e) => e.titulo === 'Visita ao museu')).toBe(false);
    expect((await itensDo('resp')).some((i) => i.titulo === 'Visita ao museu')).toBe(true);
    expect((await itensDo('prof')).some((i) => i.titulo === 'Visita ao museu')).toBe(true);
    expect((await itensDo('ped')).map((i) => i.titulo).sort()).toEqual([
      '4º bimestre',
      'Feriado municipal',
      'Visita ao museu',
    ]);
  });

  it('editar e desativar gravam versões; a versão não pode ser alterada (append-only)', async () => {
    const editar = await chamar(
      'POST',
      `/escola/calendario/${ids19.feriado}`,
      'admin',
      ITEM({ titulo: 'Feriado da Consciência Negra', dia_fim: '2026-11-20' }),
    );
    expect(editar.statusCode).toBe(204);
    const r = await chamar('POST', `/escola/calendario/${ids19.periodo}/desativar`, 'admin');
    expect(r.statusCode).toBe(204);
    expect(
      (await chamar('POST', `/escola/calendario/${ids19.periodo}/desativar`, 'admin')).statusCode,
    ).toBe(404);
    const v = (await chamar('GET', `/escola/calendario/${ids19.feriado}/versoes`, 'admin')).json()
      .versoes;
    expect(v.map((x: { acao: string }) => x.acao)).toEqual(['editado', 'criado']);
    await expect(
      amb.admin.query("UPDATE calendario_escolar_versao SET titulo = 'x' WHERE item_id = $1", [
        ids19.feriado,
      ]),
    ).rejects.toThrow(/append-only/);
    const ev = await eventosDo('aluno1');
    expect(ev.filter((e) => e.origem === 'calendario_escolar').map((e) => e.titulo)).toEqual([
      'Feriado da Consciência Negra',
      'Visita ao museu',
    ]);
  });

  it('o aluno oculta só para si; outro perfil não oculta; item que ele não vê = 404', async () => {
    expect(
      (await chamar('POST', `/escola/calendario/${ids19.turma}/ocultar`, 'aluno2')).statusCode,
    ).toBe(404);
    expect(
      (await chamar('POST', `/escola/calendario/${ids19.turma}/ocultar`, 'prof')).statusCode,
    ).toBe(403);
    expect(
      (await chamar('POST', `/escola/calendario/${ids19.feriado}/ocultar`, 'aluno1')).statusCode,
    ).toBe(204);
    expect((await eventosDo('aluno1')).some((e) => e.titulo.startsWith('Feriado'))).toBe(false);
    expect((await eventosDo('aluno2')).some((e) => e.titulo.startsWith('Feriado'))).toBe(true);
  });

  it('outra instituição não enxerga nada (RLS)', async () => {
    expect(await itensDo('adminB')).toEqual([]);
    await withTenant(amb.bancoApp, { instituicaoId: amb.instB }, async (tx) => {
      const n = await tx.$queryRaw<unknown[]>`SELECT 1 FROM calendario_escolar`;
      expect(n).toHaveLength(0);
    });
  });
});

const REGRA = (extra: object = {}) => ({
  vigente_desde: '2026-01-01',
  arredondamento: 'decimo',
  periodos: [
    { nome: '1º semestre', inicio: '2026-02-01', fim: '2026-06-30', peso: 1 },
    { nome: '2º semestre', inicio: '2026-08-01', fim: '2026-12-15', peso: 2 },
  ],
  ...extra,
});

describe('L19 item 2: regras de notas versionadas', () => {
  it('só o Admin grava; períodos sobrepostos ou peso fora de 1 a 10 = 400', async () => {
    expect((await chamar('POST', '/escola/regras-notas', 'prof', REGRA())).statusCode).toBe(403);
    for (const ruim of [
      REGRA({
        periodos: [
          { nome: 'a', inicio: '2026-02-01', fim: '2026-07-01', peso: 1 },
          { nome: 'b', inicio: '2026-06-01', fim: '2026-12-01', peso: 1 },
        ],
      }),
      REGRA({ periodos: [{ nome: 'a', inicio: '2026-02-01', fim: '2026-07-01', peso: 0 }] }),
      REGRA({ arredondamento: 'para_cima' }),
      REGRA({ periodos: [] }),
    ])
      expect((await chamar('POST', '/escola/regras-notas', 'admin', ruim)).statusCode).toBe(400);
  });

  it('cada gravação vira versão nova; a versão não muda depois (append-only)', async () => {
    expect((await chamar('POST', '/escola/regras-notas', 'admin', REGRA())).json().numero).toBe(1);
    const r = await chamar(
      'POST',
      '/escola/regras-notas',
      'admin',
      REGRA({ vigente_desde: '2026-09-01', arredondamento: 'meio' }),
    );
    expect(r.json().numero).toBe(2);
    await expect(
      amb.admin.query("UPDATE regra_nota_versao SET arredondamento = 'nenhum'"),
    ).rejects.toThrow(/append-only/);
    const admin = (await chamar('GET', '/escola/regras-notas', 'admin')).json();
    expect(admin.versoes.map((v: { numero: number }) => v.numero)).toEqual([2, 1]);
    const aluno = (await chamar('GET', '/escola/regras-notas', 'aluno1')).json();
    expect(aluno.versoes).toEqual([]);
    expect(aluno.vigente.numero).toBe(2);
  });

  it('o lançamento e a revisão citam a regra vigente no dia da nota', async () => {
    const lancar = (dia: string, valor: number) =>
      chamar('POST', '/notas-oficiais', 'prof', {
        aluno_id: ids.aluno1,
        turma_id: turma,
        disciplina_id: disc,
        valor,
        dia,
      });
    const a = await lancar('2026-03-10', 6);
    expect(a.json().regra_numero).toBe(1);
    const b = await lancar('2026-10-01', 9);
    expect(b.json().regra_numero).toBe(2);
    const rev = await chamar('POST', `/notas-oficiais/${a.json().id}/revisoes`, 'prof', {
      valor: 7,
      motivo: 'Correção da soma',
    });
    expect(rev.statusCode).toBe(201);
    const v = await amb.admin.query(
      'SELECT numero, regra_numero FROM nota_oficial_versao WHERE nota_id = $1 ORDER BY numero',
      [a.json().id],
    );
    expect(v.rows).toEqual([
      { numero: 1, regra_numero: 1 },
      { numero: 2, regra_numero: 1 },
    ]);
  });

  it('aluno e responsável veem as médias do aluno pela regra de hoje; os outros perfis, não', async () => {
    const r = (await chamar('GET', '/notas-oficiais', 'aluno1')).json();
    expect(r.regra.numero).toBe(2);
    expect(r.notas.map((n: { regra_numero: number }) => n.regra_numero).sort()).toEqual([1, 2]);
    // Regra 2: meio ponto. 1º sem. = 7; 2º sem. = 9; final (7 + 9 x 2) / 3 = 8,33 → 8,5
    expect(r.medias).toEqual([
      expect.objectContaining({
        aluno_id: ids.aluno1,
        final: 8.5,
        periodos: [
          expect.objectContaining({ nome: '1º semestre', media: 7 }),
          expect.objectContaining({ nome: '2º semestre', media: 9 }),
        ],
      }),
    ]);
    const outro = (await chamar('GET', '/notas-oficiais', 'aluno2')).json();
    expect(outro.notas).toEqual([]);
    expect(outro.medias).toEqual([]);
    // O responsável vê as médias do filho; professor, Admin e Pedagógico não recebem médias (A-040)
    const resp = (await chamar('GET', '/notas-oficiais', 'resp')).json();
    expect(resp.medias.map((m: { aluno_id: string }) => m.aluno_id)).toEqual([ids.aluno1]);
    for (const quem of ['prof', 'admin', 'ped']) {
      const r2 = await chamar('GET', '/notas-oficiais', quem);
      expect(r2.json().regra.numero, quem).toBe(2);
      expect(r2.body, quem).not.toMatch(/media|média/i);
    }
  });
});

// PNG mínimo: só a assinatura e alguns bytes (a API confere o tipo pelos primeiros bytes)
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString(
  'base64',
);
const IDENT = (extra: object = {}) => ({
  nome_exibicao: 'Escola Municipal Exemplo',
  cor_claro: '#155BB4',
  cor_escuro: '#8cbcff',
  logotipo: { tipo: 'image/png', dados: PNG },
  ...extra,
});

describe('L19 item 3: identidade visual', () => {
  it('sem identidade gravada, todos leem vazio; só o Admin grava', async () => {
    expect((await chamar('GET', '/escola/identidade', 'aluno1')).json().identidade).toBeNull();
    expect((await chamar('POST', '/escola/identidade', 'ped', IDENT())).statusCode).toBe(403);
  });

  it('recusa cor sem contraste, SVG disfarçado e logotipo grande demais', async () => {
    expect(
      (await chamar('POST', '/escola/identidade', 'admin', IDENT({ cor_claro: '#ffff00' })))
        .statusCode,
    ).toBe(422);
    expect(
      (await chamar('POST', '/escola/identidade', 'admin', IDENT({ cor_escuro: '#155bb4' })))
        .statusCode,
    ).toBe(422);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString('base64');
    expect(
      (
        await chamar(
          'POST',
          '/escola/identidade',
          'admin',
          IDENT({ logotipo: { tipo: 'image/png', dados: svg } }),
        )
      ).statusCode,
    ).toBe(422);
    const grande = Buffer.alloc(210 * 1024, 1).toString('base64');
    expect(
      (
        await chamar(
          'POST',
          '/escola/identidade',
          'admin',
          IDENT({ logotipo: { tipo: 'image/png', dados: grande } }),
        )
      ).statusCode,
    ).toBe(400);
  });

  it('grava versão; o logotipo sai com o tipo certo e "nosniff"; "manter" e null funcionam', async () => {
    const r = await chamar('POST', '/escola/identidade', 'admin', IDENT());
    expect(r.statusCode).toBe(201);
    expect(r.json().identidade).toEqual({
      numero: 1,
      nome_exibicao: 'Escola Municipal Exemplo',
      cor_claro: '#155bb4',
      cor_escuro: '#8cbcff',
      tem_logotipo: true,
    });
    const logo = await chamar('GET', '/escola/identidade/logotipo', 'aluno1');
    expect(logo.statusCode).toBe(200);
    expect(logo.headers['content-type']).toBe('image/png');
    expect(logo.headers['x-content-type-options']).toBe('nosniff');
    expect(logo.rawPayload.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const manter = await chamar(
      'POST',
      '/escola/identidade',
      'admin',
      IDENT({ nome_exibicao: 'Escola Exemplo', logotipo: 'manter', cor_escuro: null }),
    );
    expect(manter.json().identidade).toMatchObject({
      numero: 2,
      tem_logotipo: true,
      cor_escuro: null,
    });
    const sem = await chamar('POST', '/escola/identidade', 'admin', IDENT({ logotipo: null }));
    expect(sem.json().identidade).toMatchObject({ numero: 3, tem_logotipo: false });
    expect((await chamar('GET', '/escola/identidade/logotipo', 'aluno1')).statusCode).toBe(404);
    const versoes = (await chamar('GET', '/escola/identidade', 'admin')).json().versoes;
    expect(versoes.map((v: { numero: number }) => v.numero)).toEqual([3, 2, 1]);
    expect((await chamar('GET', '/escola/identidade', 'prof')).json().versoes).toEqual([]);
    await expect(
      amb.admin.query("UPDATE identidade_instituicao_versao SET nome_exibicao = 'x'"),
    ).rejects.toThrow(/append-only/);
  });

  it('a outra instituição não vê a identidade (RLS) e a cadeia de auditoria continua íntegra', async () => {
    expect((await chamar('GET', '/escola/identidade', 'adminB')).json().identidade).toBeNull();
    const n = await amb.admin.query(
      "SELECT count(*)::int AS n FROM auditoria_evento WHERE acao IN ('identidade.versao_criada', 'regra_nota.versao_criada', 'calendario_escolar.criado')",
    );
    expect(n.rows[0].n).toBe(3 + 2 + 3);
    for (const inst of [amb.instA, amb.instB])
      await withTenant(amb.bancoApp, { instituicaoId: inst }, async (tx) => {
        expect(await verificarCadeia(tx)).toEqual([]);
      });
  });
});
