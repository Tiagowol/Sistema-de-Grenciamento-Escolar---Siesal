import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { hashSenha } from '../auth/senha.js';
import { base32Decodificar, codigoTotp, passoDe } from '../auth/totp.js';
import { criarOperadores } from '../migrar/bootstrap.js';
import { emitirConviteMaster } from '../migrar/convite-master.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// L22f (migração 0033): o Master indica um Admin para atender o suporte dos espaços individuais; a fila só traz
// pedidos de espaço "individual", só com os campos combinados (Q1 = A); a indicação vale a cada chamada. Dados fictícios.
const SENHA = 'senha de teste longa 123';
const SENHA_MASTER = 'senha ficticia do master 123';
let amb: Ambiente;
let app: FastifyInstance;
let master = '';
const cookies: Record<string, string> = {};
const ids: Record<string, string> = {};

const chamar = (
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  cookie?: string,
  payload?: unknown,
) =>
  app.inject({
    method: metodo,
    url,
    payload: payload as object,
    headers: cookie ? { cookie } : {},
  });
const cookieDe = (r: { headers: Record<string, unknown> }) =>
  String(r.headers['set-cookie']).split(';')[0] as string;

async function pessoa(inst: string, perfil: string, apelido: string) {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@l22f.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
    [id, inst, perfil, `Pessoa ${apelido}`, email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
    [inst, id, await hashSenha(SENHA)],
  );
  ids[apelido] = id;
  const r = await chamar('POST', '/auth/login', undefined, {
    instituicao_id: inst,
    email,
    senha: SENHA,
  });
  expect(r.statusCode, r.body).toBe(200);
  let cookie = cookieDe(r);
  if (perfil === 'admin') {
    const ini = await chamar('POST', '/auth/totp/iniciar', cookie, {});
    const ok = await chamar('POST', '/auth/totp/confirmar', cookie, {
      codigo: codigoTotp(base32Decodificar(ini.json().segredo), passoDe(new Date())),
    });
    expect(ok.statusCode).toBe(200);
    cookie = cookieDe(ok);
  }
  cookies[apelido] = cookie;
  return { id, email };
}

// Espaço individual com 1 pessoa e 1 pedido aberto (inserido pelo administrador do banco de teste)
async function espacoComPedido(apelido: string, texto: string, assunto = 'acesso') {
  const espaco = randomUUID();
  const usuario = randomUUID();
  const pedido = randomUUID();
  await amb.admin.query(
    "INSERT INTO instituicao (id, nome, tipo, situacao) VALUES ($1, 'Espaço individual', 'individual', 'ativa')",
    [espaco],
  );
  await amb.admin.query(
    "INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,'responsavel',$3,$4)",
    [usuario, espaco, `Familia ${apelido}`, `${apelido}@familia.exemplo`],
  );
  await amb.admin.query(
    'INSERT INTO pedido_suporte (instituicao_id, id, usuario_id, assunto, texto) VALUES ($1,$2,$3,$4,$5)',
    [espaco, pedido, usuario, assunto, texto],
  );
  return { espaco, usuario, pedido };
}

beforeAll(async () => {
  amb = await criarAmbiente();
  await amb.admin.query(
    "UPDATE instituicao SET situacao = 'ativa', tipo = 'escola' WHERE id = ANY($1)",
    [[amb.instA, amb.instB]],
  );
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => new Date(),
    limiteTentativasPorMinuto: 1000,
  });
  await criarOperadores(amb.urlAdminDoBanco, ['master_l22f', 'master_l22f2']);
  const convite = await emitirConviteMaster(amb.urlAdminDoBanco, 'master_l22f');
  const r = await chamar('POST', '/operacao/primeiro-acesso', undefined, {
    usuario: 'master_l22f',
    convite,
    senha_nova: SENHA_MASTER,
  });
  const limitado = cookieDe(r);
  const ini = await chamar('POST', '/operacao/totp/iniciar', limitado, {});
  const ok = await chamar('POST', '/operacao/totp/confirmar', limitado, {
    codigo: codigoTotp(base32Decodificar(ini.json().segredo), passoDe(new Date())),
  });
  expect(ok.statusCode).toBe(200);
  master = cookieDe(ok);
  for (const [inst, perfil, apelido] of [
    [amb.instA, 'admin', 'adminA'],
    [amb.instA, 'admin', 'adminA2'],
    [amb.instB, 'admin', 'adminB'],
    [amb.instA, 'professor', 'profA'],
    [amb.instA, 'pedagogico', 'pedA'],
    [amb.instA, 'aluno', 'alunoA'],
    [amb.instA, 'responsavel', 'respA'],
  ] as const)
    await pessoa(inst, perfil, apelido);
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

const indicar = (instituicao: string, apelido: string, cookie = master) =>
  chamar('POST', '/operacao/suporte-atendentes/indicar', cookie, {
    instituicao_id: instituicao,
    usuario_id: ids[apelido],
  });
const retirar = (instituicao: string, apelido: string) =>
  chamar('POST', '/operacao/suporte-atendentes/retirar', master, {
    instituicao_id: instituicao,
    usuario_id: ids[apelido],
  });

describe('L22f item 1: indicar e retirar o Admin atendente', () => {
  it('sem sessão do Master, 401; sessão da escola não vale no console', async () => {
    expect((await chamar('GET', '/operacao/suporte-atendentes')).statusCode).toBe(401);
    expect((await indicar(amb.instA, 'adminA', cookies.adminA)).statusCode).toBe(401);
  });

  it('antes da indicação, ninguém da escola lê a fila: Admin 403 (com rastro), demais perfis 403, sem sessão 401', async () => {
    expect((await chamar('GET', '/suporte-individual')).statusCode).toBe(401);
    for (const a of ['adminA', 'profA', 'pedA', 'alunoA', 'respA'])
      expect((await chamar('GET', '/suporte-individual', cookies[a])).statusCode, a).toBe(403);
    const aud = await amb.admin.query(
      "SELECT 1 FROM auditoria_evento WHERE instituicao_id = $1 AND acao = 'suporte_individual.acesso_negado'",
      [amb.instA],
    );
    expect(aud.rowCount).toBe(1); // só o Admin que tentou deixa rastro
    const eu = await chamar('GET', '/auth/eu', cookies.adminA);
    expect(eu.json().atendente_suporte).toBe(false);
  });

  it('o Master lista os Admins ativos de escolas ativas e indica um; a trilha registra', async () => {
    const lista = await chamar('GET', '/operacao/suporte-atendentes', master);
    expect(lista.statusCode).toBe(200);
    const admins = lista.json().admins as { usuario_id: string; indicado: boolean }[];
    expect(admins.map((a) => a.usuario_id).sort()).toEqual(
      [ids.adminA, ids.adminA2, ids.adminB].sort(),
    );
    expect(admins.every((a) => !a.indicado)).toBe(true);
    // só estes campos saem
    expect(Object.keys(lista.json().admins[0]).sort()).toEqual(
      ['email', 'indicado', 'instituicao_id', 'instituicao_nome', 'nome', 'usuario_id'].sort(),
    );
    expect((await indicar(amb.instA, 'adminA')).statusCode).toBe(204);
    const trilha = await amb.admin.query(
      "SELECT 1 FROM operator_auditoria WHERE acao = 'suporte_atendente.indicado' AND alvo = $1",
      [`usuario:${ids.adminA}`],
    );
    expect(trilha.rowCount).toBe(1);
  });

  it('indicar de novo dá 409; quem não é Admin ativo (professor) dá 404; dado inválido dá 400', async () => {
    expect((await indicar(amb.instA, 'adminA')).statusCode).toBe(409);
    expect((await indicar(amb.instA, 'profA')).statusCode).toBe(404);
    const ruim = await chamar('POST', '/operacao/suporte-atendentes/indicar', master, {
      instituicao_id: 'x',
    });
    expect(ruim.statusCode).toBe(400);
  });

  it('o Admin indicado passa a ver o menu (/auth/eu); o não indicado não', async () => {
    expect((await chamar('GET', '/auth/eu', cookies.adminA)).json().atendente_suporte).toBe(true);
    expect((await chamar('GET', '/auth/eu', cookies.adminA2)).json().atendente_suporte).toBe(false);
    expect((await chamar('GET', '/auth/eu', cookies.adminB)).json().atendente_suporte).toBe(false);
  });
});

describe('L22f item 2: fila e atendimento', () => {
  let a: Awaited<ReturnType<typeof espacoComPedido>>;
  let b: Awaited<ReturnType<typeof espacoComPedido>>;
  let pedidoEscola = '';
  beforeAll(async () => {
    a = await espacoComPedido('maria', 'Não consigo entrar na minha conta.');
    b = await espacoComPedido('joao', 'Apareceu um erro na tela.', 'erro_na_tela');
    await amb.admin.query(
      "UPDATE pedido_suporte SET criado_em = now() - interval '3 days' WHERE id = $1",
      [a.pedido],
    );
    // Pedido de uma ESCOLA: nunca pode aparecer na fila dos espaços
    pedidoEscola = randomUUID();
    await amb.admin.query(
      "INSERT INTO pedido_suporte (instituicao_id, id, usuario_id, assunto, texto) VALUES ($1,$2,$3,'outro','Pedido de escola, não deve aparecer.')",
      [amb.instA, pedidoEscola, ids.alunoA],
    );
  });

  it('o Admin indicado lê a fila: só espaços individuais, do mais antigo ao mais novo, só os campos combinados', async () => {
    const r = await chamar('GET', '/suporte-individual', cookies.adminA);
    expect(r.statusCode, r.body).toBe(200);
    const pedidos = r.json().pedidos as Record<string, string>[];
    expect(pedidos.map((p) => p.pedido_id)).toEqual([a.pedido, b.pedido]);
    expect(pedidos.some((p) => p.pedido_id === pedidoEscola)).toBe(false);
    expect(Object.keys(pedidos[0] as object).sort()).toEqual(
      [
        'assunto',
        'assunto_rotulo',
        'criado_em',
        'email',
        'espaco_id',
        'nome',
        'pedido_id',
        'texto',
      ].sort(),
    );
    expect(pedidos[0]?.nome).toBe('Familia maria');
    expect(pedidos[0]?.email).toBe('maria@familia.exemplo');
    // a abertura deixa registro na cadeia da escola do Admin
    const aud = await amb.admin.query(
      "SELECT 1 FROM auditoria_evento WHERE instituicao_id = $1 AND acao = 'suporte_individual.fila_aberta'",
      [amb.instA],
    );
    expect(aud.rowCount).toBeGreaterThanOrEqual(1);
  });

  it('o Master lê a mesma fila e a abertura fica na trilha dele', async () => {
    const r = await chamar('GET', '/operacao/suporte-individual', master);
    expect(r.statusCode).toBe(200);
    const pedidos = r.json().pedidos as { pedido_id: string }[];
    expect(pedidos.map((p) => p.pedido_id)).toEqual([a.pedido, b.pedido]);
    expect(Object.keys(pedidos[0] as object).sort()).toEqual(
      ['assunto', 'criado_em', 'email', 'espaco_id', 'nome', 'pedido_id', 'texto'].sort(),
    );
    const t = await amb.admin.query(
      "SELECT 1 FROM operator_auditoria WHERE acao = 'suporte_individual.fila_aberta'",
    );
    expect(t.rowCount).toBeGreaterThanOrEqual(1);
    expect((await chamar('GET', '/operacao/suporte-individual/contagem', master)).json()).toEqual({
      abertos: 2,
    });
  });

  it('o sino Mensagens do Admin indicado mostra só a quantidade; quem não é indicado não vê o item', async () => {
    const r = await chamar('GET', '/caixa', cookies.adminA);
    const item = (r.json().itens as { tipo: string; abertos?: number }[]).find(
      (i) => i.tipo === 'suporte_individual',
    );
    expect(item?.abertos).toBe(2);
    const outro = await chamar('GET', '/caixa', cookies.adminA2);
    expect(
      (outro.json().itens as { tipo: string }[]).some((i) => i.tipo === 'suporte_individual'),
    ).toBe(false);
    // abrir a caixa não tenta gravar "visto" para este item
    expect((await chamar('POST', '/caixa/vistos', cookies.adminA)).statusCode).toBe(200);
  });

  it('Admin não indicado, de outra escola ou da mesma, recebe 403 na fila e no atendimento', async () => {
    for (const quem of ['adminA2', 'adminB']) {
      expect((await chamar('GET', '/suporte-individual', cookies[quem])).statusCode, quem).toBe(
        403,
      );
      const r = await chamar('POST', `/suporte-individual/${a.pedido}/atender`, cookies[quem], {
        espaco_id: a.espaco,
      });
      expect(r.statusCode, quem).toBe(403);
    }
    const ainda = await amb.admin.query('SELECT estado FROM pedido_suporte WHERE id = $1', [
      a.pedido,
    ]);
    expect(ainda.rows[0].estado).toBe('aberto');
  });

  it('atender: 204, estado atendido sem usuário do espaço, e o registro nas cadeias (sem nome do atendente no espaço)', async () => {
    const r = await chamar('POST', `/suporte-individual/${a.pedido}/atender`, cookies.adminA, {
      espaco_id: a.espaco,
    });
    expect(r.statusCode, r.body).toBe(204);
    const p = await amb.admin.query(
      'SELECT estado, atendido_por, atendido_em, atendido_pela_plataforma FROM pedido_suporte WHERE id = $1',
      [a.pedido],
    );
    expect(p.rows[0].estado).toBe('atendido');
    expect(p.rows[0].atendido_por).toBeNull();
    expect(p.rows[0].atendido_em).not.toBeNull();
    expect(p.rows[0].atendido_pela_plataforma).toBe(true);
    const espaco = await amb.admin.query(
      "SELECT ator FROM auditoria_evento WHERE instituicao_id = $1 AND acao = 'suporte.atendido'",
      [a.espaco],
    );
    expect(espaco.rows.map((x) => x.ator)).toEqual(['plataforma:suporte']);
    const escola = await amb.admin.query(
      "SELECT ator FROM auditoria_evento WHERE instituicao_id = $1 AND acao = 'suporte_individual.atendido' AND alvo = $2",
      [amb.instA, `pedido_suporte:${a.pedido}`],
    );
    expect(escola.rows.map((x) => x.ator)).toEqual([`usuario:${ids.adminA}`]);
    // não volta para a fila e atender de novo dá 404
    const fila = await chamar('GET', '/suporte-individual', cookies.adminA);
    expect((fila.json().pedidos as { pedido_id: string }[]).map((x) => x.pedido_id)).toEqual([
      b.pedido,
    ]);
    const de_novo = await chamar(
      'POST',
      `/suporte-individual/${a.pedido}/atender`,
      cookies.adminA,
      {
        espaco_id: a.espaco,
      },
    );
    expect(de_novo.statusCode).toBe(404);
  });

  it('pedido de ESCOLA não pode ser atendido por este caminho (404) e continua aberto', async () => {
    const viaAdmin = await chamar(
      'POST',
      `/suporte-individual/${pedidoEscola}/atender`,
      cookies.adminA,
      {
        espaco_id: amb.instA,
      },
    );
    expect(viaAdmin.statusCode).toBe(404);
    const viaMaster = await chamar(
      'POST',
      `/operacao/suporte-individual/${pedidoEscola}/atender`,
      master,
      { espaco_id: amb.instA },
    );
    expect(viaMaster.statusCode).toBe(404);
    const p = await amb.admin.query('SELECT estado FROM pedido_suporte WHERE id = $1', [
      pedidoEscola,
    ]);
    expect(p.rows[0].estado).toBe('aberto');
  });

  it('o Master também atende: 204, trilha do Master, e a cadeia do espaço sem o nome dele', async () => {
    const r = await chamar('POST', `/operacao/suporte-individual/${b.pedido}/atender`, master, {
      espaco_id: b.espaco,
    });
    expect(r.statusCode, r.body).toBe(204);
    const t = await amb.admin.query(
      "SELECT 1 FROM operator_auditoria WHERE acao = 'suporte_individual.atendido' AND alvo = $1",
      [`pedido_suporte:${b.pedido}`],
    );
    expect(t.rowCount).toBe(1);
    const espaco = await amb.admin.query(
      "SELECT ator FROM auditoria_evento WHERE instituicao_id = $1 AND acao = 'suporte.atendido'",
      [b.espaco],
    );
    expect(espaco.rows.map((x) => x.ator)).toEqual(['plataforma:suporte']);
    expect((await chamar('GET', '/operacao/suporte-individual/contagem', master)).json()).toEqual({
      abertos: 0,
    });
  });
});

describe('L22f: o acesso do Admin indicado se corta na hora', () => {
  it('retirar a indicação: 403 na próxima chamada, nada apagado (retirado_em gravado)', async () => {
    expect((await chamar('GET', '/suporte-individual', cookies.adminA)).statusCode).toBe(200);
    expect((await retirar(amb.instA, 'adminA')).statusCode).toBe(204);
    expect((await chamar('GET', '/suporte-individual', cookies.adminA)).statusCode).toBe(403);
    expect((await chamar('GET', '/auth/eu', cookies.adminA)).json().atendente_suporte).toBe(false);
    const l = await amb.admin.query(
      'SELECT retirado_em, retirado_por FROM atendente_suporte WHERE usuario_id = $1',
      [ids.adminA],
    );
    expect(l.rowCount).toBe(1);
    expect(l.rows[0].retirado_em).not.toBeNull();
    expect((await retirar(amb.instA, 'adminA')).statusCode).toBe(409);
  });

  it('desativar o Admin indicado corta a indicação sozinha', async () => {
    expect((await indicar(amb.instA, 'adminA2')).statusCode).toBe(204);
    expect((await chamar('GET', '/suporte-individual', cookies.adminA2)).statusCode).toBe(200);
    await amb.admin.query(
      "UPDATE usuario SET situacao = 'inativo', desativado_em = now() WHERE id = $1",
      [ids.adminA2],
    );
    // a função do banco recusa mesmo que a sessão ainda existisse
    const f = await amb.admin.query('SELECT suporte_atendente_ativo($1, $2) AS ok', [
      amb.instA,
      ids.adminA2,
    ]);
    expect(f.rows[0].ok).toBe(false);
  });

  it('escola suspensa corta a indicação sozinha', async () => {
    expect((await indicar(amb.instB, 'adminB')).statusCode).toBe(204);
    expect((await chamar('GET', '/suporte-individual', cookies.adminB)).statusCode).toBe(200);
    await amb.admin.query("UPDATE instituicao SET situacao = 'suspensa' WHERE id = $1", [
      amb.instB,
    ]);
    const f = await amb.admin.query('SELECT suporte_atendente_ativo($1, $2) AS ok', [
      amb.instB,
      ids.adminB,
    ]);
    expect(f.rows[0].ok).toBe(false);
    // e o Master não vê esse Admin entre os candidatos
    const lista = await chamar('GET', '/operacao/suporte-atendentes', master);
    expect(
      (lista.json().admins as { usuario_id: string }[]).some((x) => x.usuario_id === ids.adminB),
    ).toBe(false);
  });

  it('o aplicativo não lê a tabela de atendentes nem os pedidos de outro espaço direto', async () => {
    // siesal_app não tem permissão de tabela em atendente_suporte: qualquer leitura direta falha
    const negado = await amb.bancoApp
      .$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.instituicao_id', ${amb.instA}, true)`;
        return tx.$queryRaw`SELECT count(*)::int AS n FROM atendente_suporte`;
      })
      .then(
        () => false,
        () => true,
      );
    expect(negado).toBe(true);
  });
});
