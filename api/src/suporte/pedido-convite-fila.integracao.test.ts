import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import type { Email } from '../auth/email.js';
import { hashSenha } from '../auth/senha.js';
import { base32Decodificar, codigoTotp, passoDe } from '../auth/totp.js';
import { criarOperadores } from '../migrar/bootstrap.js';
import { emitirConviteMaster } from '../migrar/convite-master.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// L22i item 3 (migração 0035): fila de pedidos de convite do Master e do Admin indicado. Aprovar cria o convite e envia o
// código por e-mail; recusar avisa sem dizer o motivo; se o e-mail falhar nada muda. Dados fictícios.
const SENHA = 'senha de teste longa 123';
const SENHA_MASTER = 'senha ficticia do master 123';
let amb: Ambiente;
let app: FastifyInstance;
let master = '';
const cookies: Record<string, string> = {};
const ids: Record<string, string> = {};
const enviados: Email[] = [];
let emailFalha = false;

const chamar = (metodo: 'GET' | 'POST', url: string, cookie?: string, payload?: unknown) =>
  app.inject({
    method: metodo,
    url,
    payload: payload as object,
    headers: cookie ? { cookie } : {},
  });
const cookieDe = (r: { headers: Record<string, unknown> }) =>
  String(r.headers['set-cookie']).split(';')[0] as string;
const pedir = (apelido: string) =>
  chamar('POST', '/auth/solicitar-convite', undefined, {
    nome: `Pessoa ${apelido}`,
    email: `${apelido}@pedido.exemplo`,
    motivo: 'Quero usar o SIESAL para estudar.',
  });
const idDoPedido = async (apelido: string) =>
  (
    await amb.admin.query('SELECT id FROM pedido_convite WHERE email_busca = $1', [
      `${apelido}@pedido.exemplo`,
    ])
  ).rows[0].id as string;
const estadoDe = async (id: string) =>
  (await amb.admin.query('SELECT estado FROM pedido_convite WHERE id = $1', [id])).rows[0]
    .estado as string;
const totalConvites = async () =>
  Number((await amb.admin.query('SELECT count(*)::int AS n FROM convite_individual')).rows[0].n);

async function admin(apelido: string) {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@l22i.exemplo`;
  await amb.admin.query(
    "INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,'admin',$3,$4)",
    [id, amb.instA, `Pessoa ${apelido}`, email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
    [amb.instA, id, await hashSenha(SENHA)],
  );
  ids[apelido] = id;
  const r = await chamar('POST', '/auth/login', undefined, {
    instituicao_id: amb.instA,
    email,
    senha: SENHA,
  });
  expect(r.statusCode, r.body).toBe(200);
  const cookie = cookieDe(r);
  const ini = await chamar('POST', '/auth/totp/iniciar', cookie, {});
  const ok = await chamar('POST', '/auth/totp/confirmar', cookie, {
    codigo: codigoTotp(base32Decodificar(ini.json().segredo), passoDe(new Date())),
  });
  expect(ok.statusCode).toBe(200);
  cookies[apelido] = cookieDe(ok);
}

beforeAll(async () => {
  amb = await criarAmbiente();
  await amb.admin.query(
    "UPDATE instituicao SET situacao = 'ativa', tipo = 'escola' WHERE id = $1",
    [amb.instA],
  );
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => new Date(),
    limiteTentativasPorMinuto: 1000,
    linkBase: 'http://site.exemplo',
    enviarEmail: async (e) => {
      if (emailFalha) throw new Error('caixa fora do ar');
      enviados.push(e);
    },
  });
  await criarOperadores(amb.urlAdminDoBanco, ['master_l22i', 'master_l22i2']);
  const convite = await emitirConviteMaster(amb.urlAdminDoBanco, 'master_l22i');
  const r = await chamar('POST', '/operacao/primeiro-acesso', undefined, {
    usuario: 'master_l22i',
    convite,
    senha_nova: SENHA_MASTER,
  });
  const limitado = cookieDe(r);
  const ini = await chamar('POST', '/operacao/totp/iniciar', limitado, {});
  const ok = await chamar('POST', '/operacao/totp/confirmar', limitado, {
    codigo: codigoTotp(base32Decodificar(ini.json().segredo), passoDe(new Date())),
  });
  master = cookieDe(ok);
  await admin('indicado');
  await admin('comum');
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('L22i item 3: fila de pedidos de convite', () => {
  it('sem sessão, 401; Admin que não foi indicado, 403 na fila e nas decisões', async () => {
    await pedir('p0');
    const id = await idDoPedido('p0');
    expect((await chamar('GET', '/operacao/pedidos-convite')).statusCode).toBe(401);
    expect((await chamar('POST', `/operacao/pedidos-convite/${id}/aprovar`)).statusCode).toBe(401);
    expect((await chamar('GET', '/pedidos-convite', cookies.comum)).statusCode).toBe(403);
    expect((await chamar('POST', `/pedidos-convite/${id}/aprovar`, cookies.comum)).statusCode).toBe(
      403,
    );
    expect(await estadoDe(id)).toBe('pendente');
    expect(enviados).toHaveLength(0);
  });

  it('o Master vê só nome, e-mail, motivo e quando, e a abertura fica na trilha', async () => {
    const r = await chamar('GET', '/operacao/pedidos-convite', master);
    expect(r.statusCode).toBe(200);
    const p = r.json().pedidos[0];
    expect(Object.keys(p).sort()).toEqual(['criado_em', 'email', 'motivo', 'nome', 'pedido_id']);
    const aud = await amb.admin.query(
      "SELECT 1 FROM operator_auditoria WHERE acao = 'pedido_convite.fila_aberta'",
    );
    expect(aud.rowCount).toBeGreaterThan(0);
  });

  it('aprovar cria o convite (7 dias), envia o código por e-mail e marca o pedido', async () => {
    await pedir('p1');
    const id = await idDoPedido('p1');
    const r = await chamar('POST', `/operacao/pedidos-convite/${id}/aprovar`, master);
    expect(r.statusCode, r.body).toBe(204);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]?.para).toBe('p1@pedido.exemplo');
    const texto = enviados[0]?.texto ?? '';
    const codigo = /([A-Z2-9]{4}(?:-[A-Z2-9]{4}){3})/.exec(texto)?.[1] as string;
    expect(codigo).toBeTruthy();
    expect(texto).toContain(`http://site.exemplo/cadastro/aluno#${codigo}`);
    const p = (
      await amb.admin.query(
        'SELECT estado, decidido_por, convite_id FROM pedido_convite WHERE id = $1',
        [id],
      )
    ).rows[0];
    expect(p.estado).toBe('aprovado');
    expect(p.decidido_por).toBe('master:master_l22i');
    const dias = (
      await amb.admin.query(
        'SELECT round(extract(epoch FROM (expira_em - criado_em)) / 86400) AS d FROM convite_individual WHERE id = $1',
        [p.convite_id],
      )
    ).rows[0].d;
    expect(Number(dias)).toBe(7);
    // Decidir de novo: 404 e nenhum segundo e-mail
    expect(
      (await chamar('POST', `/operacao/pedidos-convite/${id}/recusar`, master)).statusCode,
    ).toBe(404);
    expect(enviados).toHaveLength(1);
  });

  it('recusar avisa sem revelar o motivo e tira da fila', async () => {
    await pedir('p2');
    const id = await idDoPedido('p2');
    const r = await chamar('POST', `/operacao/pedidos-convite/${id}/recusar`, master);
    expect(r.statusCode).toBe(204);
    const e = enviados.at(-1) as Email;
    expect(e.para).toBe('p2@pedido.exemplo');
    expect(e.texto).toContain('Não informamos o motivo');
    expect(e.texto).not.toMatch(/[A-Z2-9]{4}-[A-Z2-9]{4}/);
    const fila = (await chamar('GET', '/operacao/pedidos-convite', master)).json().pedidos;
    expect(fila.some((x: { pedido_id: string }) => x.pedido_id === id)).toBe(false);
  });

  it('se o e-mail falhar, nada muda: o pedido continua pendente e nenhum convite nasce', async () => {
    await pedir('p3');
    const id = await idDoPedido('p3');
    const antes = await totalConvites();
    emailFalha = true;
    const r = await chamar('POST', `/operacao/pedidos-convite/${id}/aprovar`, master);
    emailFalha = false;
    expect(r.statusCode).toBe(502);
    expect(await estadoDe(id)).toBe('pendente');
    expect(await totalConvites()).toBe(antes);
  });

  it('o Admin indicado pelo Master também vê e decide, com rastro na escola; retirado, perde o acesso', async () => {
    const ind = await chamar('POST', '/operacao/suporte-atendentes/indicar', master, {
      instituicao_id: amb.instA,
      usuario_id: ids.indicado,
    });
    expect(ind.statusCode, ind.body).toBe(204);
    await pedir('p4');
    const id = await idDoPedido('p4');
    const fila = await chamar('GET', '/pedidos-convite', cookies.indicado);
    expect(fila.statusCode).toBe(200);
    expect(fila.json().pedidos.some((x: { pedido_id: string }) => x.pedido_id === id)).toBe(true);
    const antes = enviados.length;
    expect(
      (await chamar('POST', `/pedidos-convite/${id}/aprovar`, cookies.indicado)).statusCode,
    ).toBe(204);
    expect(enviados).toHaveLength(antes + 1);
    expect(
      (await amb.admin.query('SELECT decidido_por FROM pedido_convite WHERE id = $1', [id])).rows[0]
        .decidido_por,
    ).toBe(`admin:${ids.indicado}`);
    const aud = await amb.admin.query(
      "SELECT 1 FROM auditoria_evento WHERE instituicao_id = $1 AND acao = 'pedido_convite.aprovado'",
      [amb.instA],
    );
    expect(aud.rowCount).toBe(1);
    await chamar('POST', '/operacao/suporte-atendentes/retirar', master, {
      instituicao_id: amb.instA,
      usuario_id: ids.indicado,
    });
    expect((await chamar('GET', '/pedidos-convite', cookies.indicado)).statusCode).toBe(403);
  });

  it('Admin sem indicação não consegue recusar: o pedido continua pendente', async () => {
    await pedir('p5');
    const id = await idDoPedido('p5');
    const r = await chamar('POST', `/pedidos-convite/${id}/recusar`, cookies.comum);
    expect(r.statusCode).toBe(403);
    expect(await estadoDe(id)).toBe('pendente');
  });
});
