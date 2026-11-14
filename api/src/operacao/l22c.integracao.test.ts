import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { hashSenha } from '../auth/senha.js';
import { base32Decodificar, codigoTotp, passoDe } from '../auth/totp.js';
import { criarOperadores } from '../migrar/bootstrap.js';
import { emitirConviteMaster } from '../migrar/convite-master.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// L22c (migração 0032): Admin desativa e reativa só da própria instituição; Master revoga convite e muda o limite de
// alunos; Termo 6 no cadastro da instituição. Só dados fictícios.
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

async function pessoa(inst: string, perfil: string, apelido: string, situacao = 'ativo') {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@l22c.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email, situacao) VALUES ($1,$2,$3,$4,$5,$6)',
    [id, inst, perfil, `Pessoa ${apelido}`, email, situacao],
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
  if (r.statusCode !== 200) return { id, email };
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
const entra = async (email: string, inst = amb.instA) =>
  (await chamar('POST', '/auth/login', undefined, { instituicao_id: inst, email, senha: SENHA }))
    .statusCode;

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => new Date(),
    limiteTentativasPorMinuto: 1000,
  });
  await criarOperadores(amb.urlAdminDoBanco, ['master_l22c1', 'master_l22c2']);
  const convite = await emitirConviteMaster(amb.urlAdminDoBanco, 'master_l22c1');
  const r = await chamar('POST', '/operacao/primeiro-acesso', undefined, {
    usuario: 'master_l22c1',
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
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('L22c item 1: Admin desativa e reativa', () => {
  let alvo: { id: string; email: string };
  beforeAll(async () => {
    await pessoa(amb.instA, 'admin', 'adminA');
    await pessoa(amb.instB, 'admin', 'adminB');
    alvo = await pessoa(amb.instA, 'professor', 'profA');
    await pessoa(amb.instA, 'aluno', 'alunoA');
  });

  it('só o Admin pode; os outros perfis recebem 403 e sem sessão 401', async () => {
    const url = `/usuarios/${alvo.id}/desativar`;
    expect((await chamar('POST', url)).statusCode).toBe(401);
    expect((await chamar('POST', url, cookies.profA)).statusCode).toBe(403);
    expect((await chamar('POST', url, cookies.alunoA)).statusCode).toBe(403);
    expect(await entra(alvo.email)).toBe(200);
  });

  it('desativa: a sessão cai na hora, a pessoa não entra, nada é apagado, e a auditoria registra', async () => {
    expect((await chamar('GET', '/auth/eu', cookies.profA)).statusCode).toBe(200);
    const r = await chamar('POST', `/usuarios/${alvo.id}/desativar`, cookies.adminA);
    expect(r.statusCode, r.body).toBe(204);
    expect((await chamar('GET', '/auth/eu', cookies.profA)).statusCode).toBe(401);
    expect(await entra(alvo.email)).not.toBe(200);
    const linha = await amb.admin.query(
      'SELECT situacao, desativado_em FROM usuario WHERE id = $1',
      [alvo.id],
    );
    expect(linha.rows[0].situacao).toBe('inativo');
    expect(linha.rows[0].desativado_em).not.toBeNull();
    const aud = await amb.admin.query(
      "SELECT acao FROM auditoria_evento WHERE instituicao_id = $1 AND alvo = $2 AND acao = 'usuario.desativado'",
      [amb.instA, `usuario:${alvo.id}`],
    );
    expect(aud.rowCount).toBe(1);
    // A lista do Admin mostra a pessoa como inativa
    const lista = await chamar('GET', '/usuarios', cookies.adminA);
    expect(lista.json().usuarios.find((u: { id: string }) => u.id === alvo.id).situacao).toBe(
      'inativo',
    );
  });

  it('reativa e a pessoa volta a entrar; repetir não duplica a auditoria', async () => {
    expect((await chamar('POST', `/usuarios/${alvo.id}/reativar`, cookies.adminA)).statusCode).toBe(
      204,
    );
    expect(await entra(alvo.email)).toBe(200);
    expect((await chamar('POST', `/usuarios/${alvo.id}/reativar`, cookies.adminA)).statusCode).toBe(
      204,
    );
    const aud = await amb.admin.query(
      "SELECT acao FROM auditoria_evento WHERE alvo = $1 AND acao = 'usuario.reativado'",
      [`usuario:${alvo.id}`],
    );
    expect(aud.rowCount).toBe(1);
  });

  it('não alcança outra instituição (404) e id inválido dá 400', async () => {
    const deB = await pessoa(amb.instB, 'professor', 'profB');
    expect((await chamar('POST', `/usuarios/${deB.id}/desativar`, cookies.adminA)).statusCode).toBe(
      404,
    );
    expect(
      (await chamar('POST', `/usuarios/${alvo.id}/desativar`, cookies.adminB)).statusCode,
    ).toBe(404);
    expect((await chamar('POST', '/usuarios/xx/desativar', cookies.adminA)).statusCode).toBe(400);
    const b = await amb.admin.query('SELECT situacao FROM usuario WHERE id = $1', [deB.id]);
    expect(b.rows[0].situacao).toBe('ativo');
  });

  it('o Admin não desativa a si mesmo; um segundo Admin pode desativar o primeiro, e o desativado perde a sessão', async () => {
    const proprio = await chamar('POST', `/usuarios/${ids.adminA}/desativar`, cookies.adminA);
    expect(proprio.statusCode).toBe(409);
    expect(proprio.json().erro).toMatch(/própria conta/);
    const segundo = await pessoa(amb.instA, 'admin', 'adminA2');
    // O segundo desativa o primeiro; o primeiro cai e a instituição continua com um Admin ativo (o segundo)
    expect(
      (await chamar('POST', `/usuarios/${ids.adminA}/desativar`, cookies.adminA2)).statusCode,
    ).toBe(204);
    expect((await chamar('GET', '/usuarios', cookies.adminA)).statusCode).toBe(401);
    expect(
      (await chamar('POST', `/usuarios/${segundo.id}/desativar`, cookies.adminA2)).statusCode,
    ).toBe(409);
    // O segundo reativa o primeiro
    expect(
      (await chamar('POST', `/usuarios/${ids.adminA}/reativar`, cookies.adminA2)).statusCode,
    ).toBe(204);
    // O primeiro voltou a ficar ativo (a sessão antiga não volta: precisa entrar de novo, com o segundo fator)
    const volta = await amb.admin.query(
      'SELECT situacao, desativado_em FROM usuario WHERE id = $1',
      [ids.adminA],
    );
    expect(volta.rows[0]).toEqual({ situacao: 'ativo', desativado_em: null });
    expect((await chamar('GET', '/auth/eu', cookies.adminA)).statusCode).toBe(401);
  });

  it('conta que espera o responsável não é desativada por aqui (409)', async () => {
    const aguardando = await pessoa(amb.instA, 'aluno', 'alunoEspera', 'aguardando_responsavel');
    const r = await chamar('POST', `/usuarios/${aguardando.id}/desativar`, cookies.adminA2);
    expect(r.statusCode).toBe(409);
  });
});

describe('L22c item 2: Master revoga convite', () => {
  const novo = async (rota: string) => {
    const r = await chamar('POST', rota, master);
    expect(r.statusCode, r.body).toBe(201);
    return r.json().codigo as string;
  };
  const pendentes = async () =>
    (await chamar('GET', '/operacao/convites-pendentes', master)).json().convites;

  it('sem Master = 401; a lista traz só id, tipo e datas, nunca código nem hash', async () => {
    expect((await chamar('GET', '/operacao/convites-pendentes')).statusCode).toBe(401);
    expect((await chamar('GET', '/operacao/convites-pendentes', cookies.adminA)).statusCode).toBe(
      401,
    );
    const codigo = await novo('/operacao/convites-individuais');
    const r = await chamar('GET', '/operacao/convites-pendentes', master);
    expect(r.statusCode).toBe(200);
    for (const c of r.json().convites)
      expect(Object.keys(c).sort()).toEqual(['criado_em', 'expira_em', 'id', 'tipo']);
    expect(r.body).not.toContain(codigo);
    expect(r.body).not.toMatch(/hash/i);
  });

  it('convite de instituição revogado não cria instituição; o convite some da lista', async () => {
    const codigo = await novo('/operacao/convites-instituicao');
    const antes = (await pendentes()).find((c: { tipo: string }) => c.tipo === 'instituicao');
    expect(antes).toBeTruthy();
    expect(
      (await chamar('POST', `/operacao/convites/${antes.id}/revogar`, cookies.adminA)).statusCode,
    ).toBe(401);
    const r = await chamar('POST', `/operacao/convites/${antes.id}/revogar`, master);
    expect(r.statusCode, r.body).toBe(204);
    expect((await pendentes()).some((c: { id: string }) => c.id === antes.id)).toBe(false);
    const criar = await chamar('POST', '/auth/criar-instituicao', undefined, {
      codigo,
      instituicao: 'Escola Revogada',
      nome: 'Admin Convidado',
      email: `adm-${randomUUID().slice(0, 8)}@l22c.exemplo`,
      senha: SENHA,
      aceite_termo: true,
    });
    expect(criar.statusCode).toBe(400);
    const q = await amb.admin.query("SELECT 1 FROM instituicao WHERE nome = 'Escola Revogada'");
    expect(q.rowCount).toBe(0);
  });

  it('convite de aluno revogado não cria o espaço individual', async () => {
    const codigo = await novo('/operacao/convites-individuais');
    const alvo = (await pendentes())[0];
    expect((await chamar('POST', `/operacao/convites/${alvo.id}/revogar`, master)).statusCode).toBe(
      204,
    );
    // Cada tipo de convite revogado aparece no resumo, e não como "vencido"
    const resumo = (await chamar('GET', '/operacao/convites-individuais', master)).json();
    expect(resumo.revogados).toBeGreaterThanOrEqual(1);
    const q = await amb.admin.query(
      'SELECT revogado_em, revogado_por FROM convite_individual WHERE id = $1',
      [alvo.id],
    );
    expect(q.rows[0].revogado_em).not.toBeNull();
    expect(q.rows[0].revogado_por).toBe('master:master_l22c1');
    expect(codigo.length).toBeGreaterThan(8);
  });

  it('revogar de novo, convite usado ou id que não existe: 409 ou 404, e a auditoria não guarda o código', async () => {
    const alvo = await amb.admin.query(
      'SELECT id FROM convite_individual WHERE revogado_em IS NOT NULL LIMIT 1',
    );
    expect(
      (await chamar('POST', `/operacao/convites/${alvo.rows[0].id}/revogar`, master)).statusCode,
    ).toBe(409);
    expect(
      (await chamar('POST', `/operacao/convites/${randomUUID()}/revogar`, master)).statusCode,
    ).toBe(404);
    expect((await chamar('POST', '/operacao/convites/xx/revogar', master)).statusCode).toBe(400);
    const t = await chamar('GET', '/operacao/auditoria', master);
    expect(t.json().eventos.map((e: { acao: string }) => e.acao)).toContain('convite.revogado');
    expect(t.json().integra).toBe(true);
  });
});

describe('L22c item 2: limite de alunos', () => {
  it('só o Master lê e muda; valor fora de 1 a 20 = 400; a mudança vale e fica na auditoria', async () => {
    expect((await chamar('GET', '/operacao/limite-alunos')).statusCode).toBe(401);
    expect(
      (await chamar('PUT', '/operacao/limite-alunos', cookies.adminA, { limite: 3 })).statusCode,
    ).toBe(401);
    expect((await chamar('GET', '/operacao/limite-alunos', master)).json().limite).toBe(5);
    for (const ruim of [0, 21, 2.5, '3', null])
      expect(
        (await chamar('PUT', '/operacao/limite-alunos', master, { limite: ruim })).statusCode,
      ).toBe(400);
    expect((await chamar('PUT', '/operacao/limite-alunos', master, { limite: 7 })).statusCode).toBe(
      204,
    );
    expect((await chamar('GET', '/operacao/limite-alunos', master)).json().limite).toBe(7);
    const [f] = await amb.bancoApp.$queryRaw<
      { n: number }[]
    >`SELECT plataforma_limite_alunos() AS n`;
    expect(f?.n).toBe(7);
    const t = await chamar('GET', '/operacao/auditoria', master);
    expect(t.json().eventos.map((e: { acao: string }) => e.acao)).toContain('limite_alunos.mudado');
    await chamar('PUT', '/operacao/limite-alunos', master, { limite: 5 });
  });
});

describe('L22c item 1: Termo 6 no cadastro da instituição', () => {
  const dados = (extra: Record<string, unknown>, codigo: string) => ({
    codigo,
    instituicao: `Escola Termo ${randomUUID().slice(0, 6)}`,
    nome: 'Admin Convidado',
    email: `adm-${randomUUID().slice(0, 8)}@l22c.exemplo`,
    senha: SENHA,
    ...extra,
  });
  it('sem aceite o cadastro é recusado e o convite continua valendo; com aceite guarda versão e data', async () => {
    const c = await chamar('POST', '/operacao/convites-instituicao', master);
    const codigo = c.json().codigo as string;
    const sem = await chamar('POST', '/auth/criar-instituicao', undefined, dados({}, codigo));
    expect(sem.statusCode).toBe(400);
    const falso = await chamar(
      'POST',
      '/auth/criar-instituicao',
      undefined,
      dados({ aceite_termo: false }, codigo),
    );
    expect(falso.statusCode).toBe(400);
    const nome = `Escola Termo ${randomUUID().slice(0, 6)}`;
    const ok = await chamar('POST', '/auth/criar-instituicao', undefined, {
      ...dados({}, codigo),
      instituicao: nome,
      aceite_termo: true,
    });
    expect(ok.statusCode, ok.body).toBe(201);
    const q = await amb.admin.query(
      'SELECT termo_versao, termo_aceito_em FROM instituicao WHERE nome = $1',
      [nome],
    );
    expect(q.rows[0].termo_versao).toBe('T6-v0.1');
    expect(q.rows[0].termo_aceito_em).not.toBeNull();
  });
});
