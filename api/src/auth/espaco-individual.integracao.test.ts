import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { withTenant } from '../banco/withTenant.js';
import { criarOperadores } from '../migrar/bootstrap.js';
import { emitirConviteMaster } from '../migrar/convite-master.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import { hashSenha } from './senha.js';
import { base32Decodificar, codigoTotp, passoDe } from './totp.js';

// 20c-1 (migração 0020): espaço individual do aluno sem instituição, entrada "Sem instituição", isolamento nos
// 3 sentidos, Master só com a quantidade, índice de e-mails e conversão das disciplinas antigas (F-054). Dados fictícios.
const SENHA = 'senha de teste longa 123';
const SENHA_MASTER = 'senha ficticia do master 123';
let amb: Ambiente;
let app: FastifyInstance;
let master = '';
const cookies: Record<string, string> = {};
const ids: Record<string, string> = {};
const emails: Record<string, string> = {};
const espaco: Record<string, string> = {};

const chamar = (
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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
const cookieDe = (r: { headers: Record<string, unknown> }) =>
  String(r.headers['set-cookie']).split(';')[0] as string;
const entrarSemInstituicao = (email: string, senha = SENHA) =>
  app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { sem_instituicao: true, email, senha },
  });

async function criarUsuario(instituicao: string, perfil: string, apelido: string) {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@ei.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
    [id, instituicao, perfil, `Pessoa ${apelido}`, email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
    [instituicao, id, await hashSenha(SENHA)],
  );
  ids[apelido] = id;
  emails[apelido] = email;
  return { id, email };
}
async function criarEspaco(apelido: string) {
  const inst = randomUUID();
  await amb.admin.query(
    "INSERT INTO instituicao (id, nome, tipo) VALUES ($1, 'Espaço individual', 'individual')",
    [inst],
  );
  espaco[apelido] = inst;
  await criarUsuario(inst, 'aluno', apelido);
}
async function entrarComo(apelido: string) {
  const r = await entrarSemInstituicao(emails[apelido] as string);
  expect(r.statusCode, r.body).toBe(200);
  cookies[apelido] = cookieDe(r);
}

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => new Date(),
    limiteTentativasPorMinuto: 1000,
  });
  // Master
  await criarOperadores(amb.urlAdminDoBanco, ['master_20c', 'master_20d']);
  const convite = await emitirConviteMaster(amb.urlAdminDoBanco, 'master_20c');
  const r = await app.inject({
    method: 'POST',
    url: '/operacao/primeiro-acesso',
    payload: { usuario: 'master_20c', convite, senha_nova: SENHA_MASTER },
  });
  const limitado = cookieDe(r);
  const ini = await app.inject({
    method: 'POST',
    url: '/operacao/totp/iniciar',
    payload: {},
    headers: { cookie: limitado },
  });
  const ok = await app.inject({
    method: 'POST',
    url: '/operacao/totp/confirmar',
    payload: { codigo: codigoTotp(base32Decodificar(ini.json().segredo), passoDe(new Date())) },
    headers: { cookie: limitado },
  });
  master = cookieDe(ok);
  // Dois espaços individuais e um aluno de escola
  await criarEspaco('i1');
  await criarEspaco('i2');
  await criarUsuario(amb.instA, 'aluno', 'esc');
  const re = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { instituicao_id: amb.instA, email: emails.esc, senha: SENHA },
  });
  cookies.esc = cookieDe(re);
  await entrarComo('i1');
  await entrarComo('i2');
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('banco', () => {
  it('a instituição tem tipo (escola por padrão) e só aceita escola ou individual', async () => {
    const q = await amb.admin.query('SELECT tipo FROM instituicao WHERE id = $1', [amb.instA]);
    expect(q.rows[0].tipo).toBe('escola');
    await expect(
      amb.admin.query("INSERT INTO instituicao (nome, tipo) VALUES ('x', 'turma')"),
    ).rejects.toThrow();
  });

  it('o aplicativo não lê o índice de e-mails; só a função devolve o identificador', async () => {
    await expect(amb.bancoApp.$queryRaw`SELECT * FROM espaco_individual`).rejects.toThrow();
    const [f] = await amb.bancoApp.$queryRaw<{ id: string | null }[]>`
      SELECT espaco_individual_achar(${(emails.i1 as string).toUpperCase()}) AS id`;
    expect(f?.id).toBe(espaco.i1);
    const [nada] = await amb.bancoApp.$queryRaw<{ id: string | null }[]>`
      SELECT espaco_individual_achar('ninguem@ei.exemplo') AS id`;
    expect(nada?.id).toBeNull();
  });
});

describe('entrada "Sem instituição"', () => {
  it('entra só com e-mail e senha e a sessão é do espaço individual', async () => {
    const eu = await chamar('GET', '/auth/eu', 'i1');
    expect(eu.statusCode).toBe(200);
    expect(eu.json()).toMatchObject({
      nivel: 'completo',
      espaco: 'individual',
      modulos: { mensagens: false, calendario: true, apoio_aluno: false },
    });
    const escola = await chamar('GET', '/auth/eu', 'esc');
    expect(escola.json().espaco).toBe('escola');
  });

  it('e-mail que não existe e senha errada dão a mesma resposta', async () => {
    const desconhecido = await entrarSemInstituicao('nao-existe@ei.exemplo');
    const errada = await entrarSemInstituicao(emails.i1 as string, 'senha errada qualquer 999');
    expect(desconhecido.statusCode).toBe(401);
    expect(errada.statusCode).toBe(401);
    expect(desconhecido.json()).toEqual(errada.json());
  });

  it('o corpo é fechado: instituição junto com "sem instituição" é recusada', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { sem_instituicao: true, instituicao_id: amb.instA, email: emails.i1, senha: SENHA },
    });
    expect(r.statusCode).toBe(400);
    const sem = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: emails.i1, senha: SENHA },
    });
    expect(sem.statusCode).toBe(400);
  });

  it('o e-mail de uma escola não entra por "Sem instituição"', async () => {
    const r = await entrarSemInstituicao(emails.esc as string);
    expect(r.statusCode).toBe(401);
  });
});

describe('o que existe no espaço individual', () => {
  it('as telas do aluno funcionam', async () => {
    for (const url of [
      '/tarefas',
      '/meu-dia',
      '/preferencias',
      '/minhas-disciplinas',
      '/notas-pessoais',
      '/tipos-atividade',
      '/notificacoes',
    ])
      expect((await chamar('GET', url, 'i1')).statusCode, url).toBe(200);
  });

  it('o que é da escola não existe lá (403), mas existe na escola', async () => {
    for (const url of [
      '/turmas',
      '/avisos-escolares',
      '/escola/calendario',
      '/ajuda',
      '/caixa',
      '/notas-oficiais',
      '/suporte',
      '/usuarios',
    ])
      expect((await chamar('GET', url, 'i1')).statusCode, url).toBe(403);
    // Na escola a barreira é outra (perfil e módulos): a resposta nunca é a do espaço individual
    for (const url of ['/avisos-escolares', '/escola/calendario?de=2026-11-01&ate=2026-11-30']) {
      const r = await chamar('GET', url, 'esc');
      expect(String(r.json().erro ?? ''), url).not.toContain('espaço individual');
    }
  });
});

describe('isolamento nos 3 sentidos', () => {
  it('aluno individual A não lê o aluno individual B', async () => {
    const t = await chamar('POST', '/tarefas', 'i1', { titulo: 'Só do i1' });
    expect(t.statusCode, t.body).toBe(201);
    expect((await chamar('GET', '/tarefas', 'i2')).json().tarefas).toEqual([]);
    expect(
      (await chamar('PATCH', `/tarefas/${t.json().tarefa.id}`, 'i2', { titulo: 'x' })).statusCode,
    ).toBe(404);
  });

  it('no banco: cada espaço enxerga só as próprias linhas (individual x individual, individual x escola, escola x individual)', async () => {
    const contar = (inst: string, tabela: string) =>
      withTenant(amb.bancoApp, { instituicaoId: inst }, async (tx) => {
        const l = await tx.$queryRawUnsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM ${tabela}`,
        );
        return l[0]?.n ?? 0;
      });
    // usuários: cada espaço individual tem só 1; a escola A não vê os individuais
    expect(await contar(espaco.i1 as string, 'usuario')).toBe(1);
    expect(await contar(espaco.i2 as string, 'usuario')).toBe(1);
    const daEscola = await withTenant(
      amb.bancoApp,
      { instituicaoId: amb.instA },
      (tx) => tx.$queryRaw<{ id: string }[]>`SELECT id FROM usuario`,
    );
    expect(daEscola.map((u) => u.id)).not.toContain(ids.i1);
    expect(daEscola.map((u) => u.id)).not.toContain(ids.i2);
    // tarefa do i1: invisível ao i2 e à escola; a escola não deixa tarefa visível ao individual
    expect(await contar(espaco.i1 as string, 'tarefa')).toBe(1);
    expect(await contar(espaco.i2 as string, 'tarefa')).toBe(0);
    expect(await contar(amb.instA, 'tarefa')).toBe(0);
    await chamar('POST', '/tarefas', 'esc', { titulo: 'Da escola' });
    expect(await contar(amb.instA, 'tarefa')).toBe(1);
    expect(await contar(espaco.i1 as string, 'tarefa')).toBe(1);
    // a instituição que cada um enxerga é só a sua
    for (const inst of [espaco.i1 as string, espaco.i2 as string, amb.instA]) {
      const vistas = await withTenant(
        amb.bancoApp,
        { instituicaoId: inst },
        (tx) => tx.$queryRaw<{ id: string }[]>`SELECT id FROM instituicao`,
      );
      expect(vistas.map((v) => v.id)).toEqual([inst]);
    }
  });

  it('a sessão de um espaço não serve em outro: sair e entrar no outro dá outro conjunto de dados', async () => {
    const a = (await chamar('GET', '/tarefas', 'i1')).json().tarefas as { titulo: string }[];
    const b = (await chamar('GET', '/tarefas', 'i2')).json().tarefas as { titulo: string }[];
    expect(a.map((t) => t.titulo)).toEqual(['Só do i1']);
    expect(b).toEqual([]);
  });
});

describe('índice de e-mails dos espaços individuais', () => {
  it('o mesmo e-mail não pode estar em dois espaços individuais; em escola e individual, pode', async () => {
    await expect(
      amb.admin.query(
        "INSERT INTO usuario (instituicao_id, perfil, nome, email) VALUES ($1, 'aluno', 'Repetido', $2)",
        [espaco.i2, (emails.i1 as string).toUpperCase()],
      ),
    ).rejects.toThrow();
    await amb.admin.query(
      "INSERT INTO usuario (instituicao_id, perfil, nome, email) VALUES ($1, 'aluno', 'Mesmo e-mail na escola', $2)",
      [amb.instB, emails.i1],
    );
    // a escola B não passou a ser achada por "Sem instituição"
    const [f] = await amb.bancoApp.$queryRaw<{ id: string | null }[]>`
      SELECT espaco_individual_achar(${emails.i1 as string}) AS id`;
    expect(f?.id).toBe(espaco.i1);
  });

  it('trocar o e-mail atualiza o índice; conta inativa não entra mais', async () => {
    await criarEspaco('i3');
    const novo = `novo-${randomUUID().slice(0, 8)}@ei.exemplo`;
    await amb.admin.query('UPDATE usuario SET email = $1 WHERE id = $2', [novo, ids.i3]);
    expect((await entrarSemInstituicao(emails.i3 as string)).statusCode).toBe(401);
    expect((await entrarSemInstituicao(novo)).statusCode).toBe(200);
    await amb.admin.query("UPDATE usuario SET situacao = 'inativo' WHERE id = $1", [ids.i3]);
    expect((await entrarSemInstituicao(novo)).statusCode).toBe(401);
    const q = await amb.admin.query(
      'SELECT count(*)::int AS n FROM espaco_individual WHERE email_busca = $1',
      [novo],
    );
    expect(q.rows[0].n).toBe(0);
  });
});

describe('Master: só a quantidade', () => {
  it('o painel não lista espaço individual e mostra só o número', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/operacao/painel',
      headers: { cookie: master },
    });
    expect(r.statusCode, r.body).toBe(200);
    const corpo = r.json();
    expect(corpo.espacos_individuais).toBe(2); // i1 e i2 (i3 ficou inativo)
    const texto = JSON.stringify(corpo);
    for (const segredo of [
      espaco.i1,
      espaco.i2,
      ids.i1,
      ids.i2,
      emails.i1,
      emails.i2,
      'Espaço individual',
      'Pessoa i1',
    ])
      expect(texto).not.toContain(segredo as string);
    expect(corpo.instituicoes.map((i: { id: string }) => i.id)).toContain(amb.instA);
    const lista = await app.inject({
      method: 'GET',
      url: '/operacao/instituicoes',
      headers: { cookie: master },
    });
    expect(JSON.stringify(lista.json())).not.toContain(espaco.i1 as string);
  });

  it('o Master não muda situação nem módulo de espaço individual (404)', async () => {
    const s = await app.inject({
      method: 'POST',
      url: `/operacao/instituicoes/${espaco.i1}/situacao`,
      payload: { situacao: 'suspensa' },
      headers: { cookie: master },
    });
    expect(s.statusCode).toBe(404);
    const m = await app.inject({
      method: 'POST',
      url: `/operacao/instituicoes/${espaco.i1}/modulos`,
      payload: { modulo: 'mensagens', ligado: true },
      headers: { cookie: master },
    });
    expect(m.statusCode).toBe(404);
  });

  it('encerrar a conta tira o espaço da contagem e ninguém mais entra', async () => {
    await amb.admin.query(
      "UPDATE usuario SET situacao = 'inativo', desativado_em = now() WHERE id = $1",
      [ids.i2],
    );
    const r = await app.inject({
      method: 'GET',
      url: '/operacao/painel',
      headers: { cookie: master },
    });
    expect(r.json().espacos_individuais).toBe(1);
    expect((await entrarSemInstituicao(emails.i2 as string)).statusCode).toBe(401);
  });
});

describe('F-054: conversão das disciplinas antigas feita pela API', () => {
  it('converte uma vez por aluno, liga tarefas e notas e não recria o que o aluno tirou', async () => {
    await criarEspaco('i5'); // aluno novo: ainda não foi convertido
    await entrarComo('i5');
    const inst = espaco.i5 as string;
    const u = ids.i5 as string;
    // texto antigo, como a 0019 deixaria: tarefa e nota com disciplina em texto e sem ligação
    await amb.admin.query(
      "INSERT INTO tarefa (instituicao_id, usuario_id, titulo, disciplina) VALUES ($1,$2,'T1','matematica'), ($1,$2,'T2','Teatro'), ($1,$2,'T3','Teatro')",
      [inst, u],
    );
    await amb.admin.query(
      "INSERT INTO nota_pessoal (instituicao_id, usuario_id, disciplina, valor, dia) VALUES ($1,$2,'Teatro',8,'2026-11-10')",
      [inst, u],
    );
    const r = await chamar('GET', '/minhas-disciplinas', 'i5');
    expect(r.statusCode, r.body).toBe(200);
    const minhas = r.json().minhas as { id: string; nome: string; origem: string }[];
    expect(minhas.find((d) => d.nome === 'Matemática')?.origem).toBe('catalogo');
    expect(minhas.find((d) => d.nome === 'Teatro')?.origem).toBe('propria');
    const ligadas = await amb.admin.query(
      'SELECT count(*)::int AS n FROM tarefa WHERE usuario_id = $1 AND disciplina_aluno_id IS NOT NULL',
      [u],
    );
    expect(ligadas.rows[0].n).toBe(3 + 0); // T1, T2 e T3 (a tarefa "Só do i1" não tem disciplina)
    const nota = await amb.admin.query(
      'SELECT count(*)::int AS n FROM nota_pessoal WHERE usuario_id = $1 AND disciplina_aluno_id IS NOT NULL',
      [u],
    );
    expect(nota.rows[0].n).toBe(1);
    // o texto antigo continua como estava
    const textos = await amb.admin.query(
      "SELECT disciplina FROM tarefa WHERE usuario_id = $1 AND titulo = 'T1'",
      [u],
    );
    expect(textos.rows[0].disciplina).toBe('matematica');
    // o aluno tira "Teatro"; uma nova abertura não recria
    const teatro = minhas.find((d) => d.nome === 'Teatro');
    await chamar('DELETE', `/minhas-disciplinas/${teatro?.id}`, 'i5');
    const de_novo = (await chamar('GET', '/minhas-disciplinas', 'i5')).json().minhas as {
      nome: string;
    }[];
    expect(de_novo.map((d) => d.nome)).not.toContain('Teatro');
    const marca = await amb.admin.query(
      'SELECT disciplinas_convertidas_em FROM preferencia_usuario WHERE usuario_id = $1',
      [u],
    );
    expect(marca.rows[0].disciplinas_convertidas_em).not.toBeNull();
  });

  it('passando de 20 textos diferentes, só 20 viram próprias; o resto continua como texto', async () => {
    await criarEspaco('i4');
    const inst = espaco.i4 as string;
    const u = ids.i4 as string;
    for (let i = 1; i <= 25; i++)
      await amb.admin.query(
        'INSERT INTO tarefa (instituicao_id, usuario_id, titulo, disciplina) VALUES ($1,$2,$3,$4)',
        [inst, u, `T${i}`, `Disciplina inventada ${String(i).padStart(2, '0')}`],
      );
    await entrarComo('i4');
    const r = await chamar('GET', '/minhas-disciplinas', 'i4');
    expect(r.statusCode, r.body).toBe(200);
    expect(
      (r.json().minhas as { origem: string }[]).filter((d) => d.origem === 'propria'),
    ).toHaveLength(20);
    const semLigacao = await amb.admin.query(
      'SELECT count(*)::int AS n FROM tarefa WHERE usuario_id = $1 AND disciplina_aluno_id IS NULL',
      [u],
    );
    expect(semLigacao.rows[0].n).toBe(5);
  });
});

describe('cadastro por convite (D4)', () => {
  const novoConvite = async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/operacao/convites-individuais',
      headers: { cookie: master },
    });
    expect(r.statusCode, r.body).toBe(201);
    return r.json().codigo as string;
  };
  const criar = (codigo: string, extra: Record<string, unknown> = {}) =>
    app.inject({
      method: 'POST',
      url: '/auth/criar-conta-individual',
      payload: {
        codigo,
        nome: 'Aluna Convidada',
        email: `conv-${randomUUID().slice(0, 8)}@ei.exemplo`,
        senha: SENHA,
        nascimento: '2000-01-15',
        ...extra,
      },
    });

  it('só o Master gera convite; o código tem 16 letras e números e o banco guarda só o hash', async () => {
    const sem = await app.inject({ method: 'POST', url: '/operacao/convites-individuais' });
    expect(sem.statusCode).toBe(401);
    const codigo = await novoConvite();
    expect(codigo).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
    const q = await amb.admin.query('SELECT codigo_hash, criado_por FROM convite_individual');
    const guardado = JSON.stringify(q.rows);
    expect(guardado).not.toContain(codigo);
    expect(guardado).not.toContain(codigo.replaceAll('-', ''));
    expect(q.rows.every((l: { codigo_hash: string }) => /^[0-9a-f]{64}$/.test(l.codigo_hash))).toBe(
      true,
    );
  });

  it('com o convite, a pessoa cria a própria conta, já entra no espaço individual e o convite não vale de novo', async () => {
    const codigo = await novoConvite();
    const email = `nova-${randomUUID().slice(0, 8)}@ei.exemplo`;
    const r = await criar(codigo.toLowerCase().replaceAll('-', ' '), { email });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({
      nivel: 'completo',
      usuario: { perfil: 'aluno', nome: 'Aluna Convidada' },
    });
    const cookie = cookieDe(r);
    const eu = await app.inject({ method: 'GET', url: '/auth/eu', headers: { cookie } });
    expect(eu.json().espaco).toBe('individual');
    // entra de novo por "Sem instituição" e o espaço tem nome genérico
    expect((await entrarSemInstituicao(email)).statusCode).toBe(200);
    const q = await amb.admin.query(
      'SELECT i.nome, i.tipo FROM instituicao i JOIN usuario u ON u.instituicao_id = i.id WHERE u.email = $1',
      [email],
    );
    expect(q.rows[0]).toEqual({ nome: 'Espaço individual', tipo: 'individual' });
    // auditoria sem dado pessoal
    const aud = await amb.admin.query(
      "SELECT acao, alvo FROM auditoria_evento WHERE acao = 'conta.criada_por_convite' ORDER BY id DESC LIMIT 1",
    );
    expect(aud.rows[0].acao).toBe('conta.criada_por_convite');
    expect(JSON.stringify(aud.rows)).not.toContain(email);
    // uso único
    const outra = await criar(codigo);
    expect(outra.statusCode).toBe(400);
  });

  it('convite inventado, vencido ou já usado dão a mesma resposta; e-mail repetido não gasta o convite', async () => {
    const inventado = await criar('AAAA-BBBB-CCCC-DDDD');
    const codigo = await novoConvite();
    await amb.admin.query(
      "UPDATE convite_individual SET expira_em = now() - interval '1 minute' WHERE codigo_hash = encode(sha256($1::bytea), 'hex')",
      [codigo.replaceAll('-', '')],
    );
    const vencido = await criar(codigo);
    expect(inventado.statusCode).toBe(400);
    expect(vencido.statusCode).toBe(400);
    expect(vencido.json()).toEqual(inventado.json());
    // e-mail que já existe em outro espaço individual: recusa e o convite continua valendo
    const valido = await novoConvite();
    const repetido = await criar(valido, { email: emails.i1 });
    expect(repetido.statusCode).toBe(400);
    expect(repetido.json()).toEqual(inventado.json());
    expect((await criar(valido)).statusCode).toBe(201);
  });

  it('dados inválidos e senha fraca são recusados antes de gastar o convite', async () => {
    const codigo = await novoConvite();
    for (const extra of [
      { nome: 'A' },
      { email: 'sem-arroba' },
      { nome: 'ver http://x.com' },
      { extra: 1 },
    ])
      expect((await criar(codigo, extra)).statusCode).toBe(400);
    const fraca = await criar(codigo, { senha: 'curta' });
    expect(fraca.statusCode).toBe(400);
    expect(fraca.json().erro).not.toContain('convite');
    expect((await criar(codigo)).statusCode).toBe(201); // o convite não foi gasto
  });

  it('o Master vê só números dos convites e a conta nova entra na contagem de espaços', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/operacao/convites-individuais',
      headers: { cookie: master },
    });
    expect(r.statusCode).toBe(200);
    const corpo = r.json();
    expect(Object.keys(corpo).sort()).toEqual([
      'instituicao',
      'pendentes',
      'revogados',
      'usados',
      'vencidos',
    ]);
    expect(corpo.usados).toBeGreaterThanOrEqual(2);
    expect(corpo.vencidos).toBeGreaterThanOrEqual(1);
    const painel = await app.inject({
      method: 'GET',
      url: '/operacao/painel',
      headers: { cookie: master },
    });
    expect(painel.json().espacos_individuais).toBeGreaterThanOrEqual(3);
  });

  it('o aplicativo não lê a tabela de convites', async () => {
    await expect(amb.bancoApp.$queryRaw`SELECT * FROM convite_individual`).rejects.toThrow();
  });
});

describe('convite de instituição (20c-3)', () => {
  const convite = async (rota = '/operacao/convites-instituicao') => {
    const r = await app.inject({ method: 'POST', url: rota, headers: { cookie: master } });
    expect(r.statusCode, r.body).toBe(201);
    return r.json().codigo as string;
  };
  const criar = (codigo: string, extra: Record<string, unknown> = {}) =>
    app.inject({
      method: 'POST',
      url: '/auth/criar-instituicao',
      payload: {
        codigo,
        instituicao: `Escola Fictícia ${randomUUID().slice(0, 6)}`,
        nome: 'Admin Convidado',
        email: `adm-${randomUUID().slice(0, 8)}@inst.exemplo`,
        senha: SENHA,
        aceite_termo: true,
        ...extra,
      },
    });

  it('só o Master gera o convite de instituição', async () => {
    const sem = await app.inject({ method: 'POST', url: '/operacao/convites-instituicao' });
    expect(sem.statusCode).toBe(401);
    expect(await convite()).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
  });

  it('com o convite, cria a instituição em implantação e o Admin entra só para ativar o segundo fator', async () => {
    const codigo = await convite();
    const email = `adm-${randomUUID().slice(0, 8)}@inst.exemplo`;
    const r = await criar(codigo, { email, instituicao: 'Escola do Convite' });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ nivel: 'configurar_totp', usuario: { perfil: 'admin' } });
    const q = await amb.admin.query(
      'SELECT i.nome, i.tipo, i.situacao, u.perfil FROM instituicao i JOIN usuario u ON u.instituicao_id = i.id WHERE u.email = $1',
      [email],
    );
    expect(q.rows[0]).toEqual({
      nome: 'Escola do Convite',
      tipo: 'escola',
      situacao: 'em_implantacao',
      perfil: 'admin',
    });
    // o Admin ainda não usa o sistema: só o segundo fator
    const eu = await app.inject({
      method: 'GET',
      url: '/auth/eu',
      headers: { cookie: cookieDe(r) },
    });
    expect(eu.json()).toMatchObject({ nivel: 'configurar_totp', espaco: 'escola' });
    const usuarios = await app.inject({
      method: 'GET',
      url: '/usuarios',
      headers: { cookie: cookieDe(r) },
    });
    expect(usuarios.statusCode).toBe(403);
    // o Master vê a escola no painel (em implantação) e muda a situação
    const painel = await app.inject({
      method: 'GET',
      url: '/operacao/painel',
      headers: { cookie: master },
    });
    const achada = painel
      .json()
      .instituicoes.find((i: { nome: string }) => i.nome === 'Escola do Convite');
    expect(achada).toMatchObject({ situacao: 'em_implantacao' });
    const ativa = await app.inject({
      method: 'POST',
      url: `/operacao/instituicoes/${achada.id}/situacao`,
      payload: { situacao: 'ativa' },
      headers: { cookie: master },
    });
    expect(ativa.statusCode).toBe(204);
    // auditoria
    const aud = await amb.admin.query(
      "SELECT acao FROM auditoria_evento WHERE acao = 'instituicao.criada_por_convite' ORDER BY id DESC LIMIT 1",
    );
    expect(aud.rows[0].acao).toBe('instituicao.criada_por_convite');
    // uso único
    expect((await criar(codigo)).statusCode).toBe(400);
  });

  it('cada convite só serve para o seu tipo', async () => {
    const deAluno = await convite('/operacao/convites-individuais');
    const deInstituicao = await convite();
    const recusadaInst = await criar(deAluno);
    expect(recusadaInst.statusCode).toBe(400);
    const recusadaAluno = await app.inject({
      method: 'POST',
      url: '/auth/criar-conta-individual',
      payload: {
        codigo: deInstituicao,
        nome: 'Aluno X',
        email: `x-${randomUUID().slice(0, 8)}@ei.exemplo`,
        senha: SENHA,
        nascimento: '2000-01-15',
      },
    });
    expect(recusadaAluno.statusCode).toBe(400);
    expect(typeof recusadaAluno.json().erro).toBe('string');
    // nenhum dos dois foi gasto
    expect((await criar(deInstituicao)).statusCode).toBe(201);
    const aluno = await app.inject({
      method: 'POST',
      url: '/auth/criar-conta-individual',
      payload: {
        codigo: deAluno,
        nome: 'Aluno Y',
        email: `y-${randomUUID().slice(0, 8)}@ei.exemplo`,
        senha: SENHA,
        nascimento: '2000-01-15',
      },
    });
    expect(aluno.statusCode, aluno.body).toBe(201);
  });

  it('inventado e vencido dão a mesma recusa; dados inválidos e senha fraca não gastam o convite', async () => {
    const inventado = await criar('AAAA-BBBB-CCCC-DDDD');
    expect(inventado.statusCode).toBe(400);
    const codigo = await convite();
    for (const extra of [
      { instituicao: 'A' },
      { nome: 'ver http://x.com' },
      { email: 'sem-arroba' },
      { extra: 1 },
    ])
      expect((await criar(codigo, extra)).statusCode).toBe(400);
    const fraca = await criar(codigo, { senha: 'curta' });
    expect(fraca.statusCode).toBe(400);
    expect(fraca.json().erro).not.toContain('convite');
    await amb.admin.query(
      "UPDATE convite_individual SET expira_em = now() - interval '1 minute' WHERE codigo_hash = encode(sha256($1::bytea), 'hex')",
      [codigo.replaceAll('-', '')],
    );
    expect((await criar(codigo)).json()).toEqual(inventado.json());
  });

  it('o resumo do Master separa os convites de instituição e traz só números', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/operacao/convites-individuais',
      headers: { cookie: master },
    });
    expect(Object.keys(r.json().instituicao).sort()).toEqual([
      'pendentes',
      'revogados',
      'usados',
      'vencidos',
    ]);
    expect(r.json().instituicao.usados).toBeGreaterThanOrEqual(1);
  });

  it('o aplicativo não cria instituição por conta própria (só pela função do convite)', async () => {
    await expect(
      amb.bancoApp
        .$executeRaw`INSERT INTO instituicao (nome, tipo, situacao) VALUES ('X', 'escola', 'em_implantacao')`,
    ).rejects.toThrow();
  });
});
