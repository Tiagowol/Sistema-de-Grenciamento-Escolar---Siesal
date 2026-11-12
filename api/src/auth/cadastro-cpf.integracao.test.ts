import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { criarOperadores } from '../migrar/bootstrap.js';
import { emitirConviteMaster } from '../migrar/convite-master.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import type { Email } from './email.js';
import { base32Decodificar, codigoTotp, passoDe } from './totp.js';

// 20c-2 (migração 0022): data de nascimento, CPF cifrado, menor de 18 anos com autorização do responsável.
// Dados fictícios. CPFs de teste com dígitos verificadores válidos.
const SENHA = 'senha de teste longa 123';
const SENHA_MASTER = 'senha ficticia do master 123';
const CPF_ALUNO = '52998224725';
const CPF_RESP = '11144477735';
let amb: Ambiente;
let app: FastifyInstance;
let semChave: FastifyInstance;
let master = '';
const caixa: Email[] = [];

const cookieDe = (r: { headers: Record<string, unknown> }) =>
  String(r.headers['set-cookie']).split(';')[0] as string;
const email = (p: string) => `${p}-${randomUUID().slice(0, 8)}@cpf.exemplo`;
const novoConvite = async () => {
  const r = await app.inject({
    method: 'POST',
    url: '/operacao/convites-individuais',
    headers: { cookie: master },
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().codigo as string;
};
const criar = async (extra: Record<string, unknown> = {}, quem: FastifyInstance = app) =>
  quem.inject({
    method: 'POST',
    url: '/auth/criar-conta-individual',
    payload: {
      codigo: await novoConvite(),
      nome: 'Aluno Fictício',
      email: email('a'),
      senha: SENHA,
      nascimento: '2000-01-15',
      ...extra,
    },
  });
const resp = (extra: Record<string, unknown> = {}) => ({
  nome: 'Responsável Fictício',
  cpf: CPF_RESP,
  nascimento: '1980-05-20',
  email: email('r'),
  ...extra,
});
const entrar = (e: string) =>
  app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { sem_instituicao: true, email: e, senha: SENHA },
  });
const tokenDoEmail = (e: Email): string => /#([A-Za-z0-9_-]+)/.exec(e.texto)?.[1] as string;
// Tudo o que o banco guarda dos dois CPFs, para provar que o texto claro não aparece
async function tudoDoBanco(): Promise<string> {
  const q = await Promise.all(
    ['aluno_dados', 'pedido_responsavel', 'auditoria_evento', 'usuario'].map((t) =>
      amb.admin.query(`SELECT * FROM ${t}`),
    ),
  );
  return JSON.stringify(q.map((r) => r.rows));
}

beforeAll(async () => {
  amb = await criarAmbiente();
  const comum = {
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => new Date('2026-11-12T12:00:00Z'),
    limiteTentativasPorMinuto: 1000,
  };
  app = criarApp({
    ...comum,
    chaveCpf: 'chave-de-teste-do-cpf-com-mais-de-32-caracteres',
    enviarEmail: async (e) => {
      caixa.push(e);
    },
  });
  semChave = criarApp(comum);
  await criarOperadores(amb.urlAdminDoBanco, ['master_20c2', 'master_20c2b']);
  const convite = await emitirConviteMaster(amb.urlAdminDoBanco, 'master_20c2');
  const r = await app.inject({
    method: 'POST',
    url: '/operacao/primeiro-acesso',
    payload: { usuario: 'master_20c2', convite, senha_nova: SENHA_MASTER },
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
    payload: {
      codigo: codigoTotp(
        base32Decodificar(ini.json().segredo),
        passoDe(new Date('2026-11-12T12:00:00Z')),
      ),
    },
    headers: { cookie: limitado },
  });
  master = cookieDe(ok);
});
afterAll(async () => {
  await app?.close();
  await semChave?.close();
  await amb?.encerrar();
});

describe('maior de 18 anos', () => {
  it('sem CPF: cria a conta e entra (CPF é opcional, D2b)', async () => {
    const r = await criar();
    expect(r.statusCode, r.body).toBe(201);
    const d = await app.inject({
      method: 'GET',
      url: '/conta/dados-cadastro',
      headers: { cookie: cookieDe(r) },
    });
    expect(d.json()).toMatchObject({ cadastrado: true, nascimento: '2000-01-15', cpf: null });
  });

  it('com CPF: guarda cifrado, mostra mascarado e o texto claro não está em lugar nenhum', async () => {
    const e = email('cpf');
    const r = await criar({
      email: e,
      cpf: '529.982.247-25',
      matricula: 'M-123',
      escolas: 'Escola Fictícia',
    });
    expect(r.statusCode, r.body).toBe(201);
    const d = await app.inject({
      method: 'GET',
      url: '/conta/dados-cadastro',
      headers: { cookie: cookieDe(r) },
    });
    expect(d.json()).toMatchObject({
      cpf: '***.***.***-25',
      matricula: 'M-123',
      escolas: 'Escola Fictícia',
    });
    // Nem a resposta, nem o banco, nem a auditoria têm o CPF em texto claro
    expect(d.body).not.toContain(CPF_ALUNO);
    expect(r.body).not.toContain(CPF_ALUNO);
    const tudo = await tudoDoBanco();
    expect(tudo).not.toContain(CPF_ALUNO);
    expect(tudo).not.toContain('529.982.247-25');
    const q = await amb.admin.query(
      'SELECT cpf_cifrado, cpf_hmac, cpf_final FROM aluno_dados WHERE cpf_final = $1',
      ['25'],
    );
    expect(q.rows[0].cpf_cifrado).toMatch(/^v1\./);
    expect(q.rows[0].cpf_hmac).toMatch(/^[0-9a-f]{64}$/);
  });

  it('recusa CPF inválido, data impossível, data futura e responsável sem precisar', async () => {
    for (const extra of [
      { cpf: '52998224726' },
      { nascimento: '2000-02-30' },
      { nascimento: '2027-01-01' },
      { responsavel: resp() },
    ]) {
      const r = await criar(extra);
      expect(r.statusCode, JSON.stringify(extra)).toBe(400);
    }
  });

  it('o convite não é gasto por dado inválido', async () => {
    const codigo = await novoConvite();
    const base = { codigo, nome: 'Aluno Fictício', email: email('g'), senha: SENHA };
    const ruim = await app.inject({
      method: 'POST',
      url: '/auth/criar-conta-individual',
      payload: { ...base, nascimento: '2000-02-30' },
    });
    expect(ruim.statusCode).toBe(400);
    const bom = await app.inject({
      method: 'POST',
      url: '/auth/criar-conta-individual',
      payload: { ...base, nascimento: '2000-01-15' },
    });
    expect(bom.statusCode, bom.body).toBe(201);
  });

  it('sem a chave do CPF, o cadastro com CPF responde 503 e sem CPF continua funcionando', async () => {
    const com = await criar({ cpf: CPF_ALUNO }, semChave);
    expect(com.statusCode).toBe(503);
    const sem = await criar({}, semChave);
    expect(sem.statusCode, sem.body).toBe(201);
  });
});

describe('menor de 18 anos', () => {
  const MENOR = '2012-03-10';

  it('sem responsável, com responsável menor de 18, com CPFs iguais ou e-mails iguais: recusa', async () => {
    const e = email('m');
    for (const extra of [
      { nascimento: MENOR },
      { nascimento: MENOR, responsavel: resp({ nascimento: '2009-01-01' }) },
      { nascimento: MENOR, cpf: CPF_RESP, responsavel: resp() },
      { nascimento: MENOR, email: e, responsavel: resp({ email: e.toUpperCase() }) },
      { nascimento: MENOR, responsavel: resp({ cpf: '11144477736' }) },
    ]) {
      const r = await criar(extra);
      expect(r.statusCode, JSON.stringify(extra)).toBe(400);
    }
  });

  it('fica aguardando, não entra, e o e-mail com o link vai para a caixa de teste', async () => {
    const e = email('m');
    const antes = caixa.length;
    const r = await criar({
      nascimento: MENOR,
      email: e,
      responsavel: resp({ email: 'resp@cpf.exemplo' }),
    });
    expect(r.statusCode, r.body).toBe(202);
    expect(r.json()).toMatchObject({ aguardando_responsavel: true, email_enviado: true });
    expect(r.headers['set-cookie']).toBeUndefined();
    expect(caixa.length).toBe(antes + 1);
    expect(caixa.at(-1)?.para).toBe('resp@cpf.exemplo');
    expect(caixa.at(-1)?.texto).toContain('/confirmar/responsavel#');
    const login = await entrar(e);
    expect(login.statusCode).toBe(401);
    const q = await amb.admin.query('SELECT situacao FROM usuario WHERE email = $1', [e]);
    expect(q.rows[0].situacao).toBe('aguardando_responsavel');
  });

  it('o link mostra o termo sem CPF; confirmar exige as 3 caixas; depois a conta entra; o link vale uma vez', async () => {
    const e = email('m');
    const r = await criar({ nascimento: MENOR, email: e, cpf: CPF_ALUNO, responsavel: resp() });
    expect(r.statusCode, r.body).toBe(202);
    const token = tokenDoEmail(caixa.at(-1) as Email);

    const c = await app.inject({
      method: 'POST',
      url: '/auth/responsavel/consultar',
      payload: { token },
    });
    expect(c.statusCode, c.body).toBe(200);
    expect(c.json().termo.caixas).toHaveLength(3);
    expect(c.json().termo.caixas[0]).toContain('Aluno Fictício');
    expect(c.body).not.toContain(CPF_RESP);
    expect(c.body).not.toContain(CPF_ALUNO);

    const poucas = await app.inject({
      method: 'POST',
      url: '/auth/responsavel/confirmar',
      payload: { token, aceites: [true, true, false] },
    });
    expect(poucas.statusCode).toBe(400);
    expect((await entrar(e)).statusCode).toBe(401);

    const ok = await app.inject({
      method: 'POST',
      url: '/auth/responsavel/confirmar',
      payload: { token, aceites: [true, true, true] },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    const login = await entrar(e);
    expect(login.statusCode, login.body).toBe(200);
    const dados = await app.inject({
      method: 'GET',
      url: '/conta/dados-cadastro',
      headers: { cookie: cookieDe(login) },
    });
    expect(dados.json().cpf).toBe('***.***.***-25');

    // uso único: o mesmo link não consulta nem confirma de novo
    const de_novo = await app.inject({
      method: 'POST',
      url: '/auth/responsavel/consultar',
      payload: { token },
    });
    expect(de_novo.statusCode).toBe(404);
    const confirma2 = await app.inject({
      method: 'POST',
      url: '/auth/responsavel/confirmar',
      payload: { token, aceites: [true, true, true] },
    });
    expect(confirma2.statusCode).toBe(400);

    // prova guardada: versão do termo e hora; auditoria do aceite sem nenhum CPF
    const p = await amb.admin.query(
      'SELECT termo_versao, confirmado_em FROM pedido_responsavel WHERE termo_versao IS NOT NULL',
    );
    expect(p.rows.some((l: { termo_versao: string }) => l.termo_versao === '1')).toBe(true);
    const a = await amb.admin.query(
      "SELECT acao FROM auditoria_evento WHERE acao = 'responsavel.autorizou'",
    );
    expect(a.rows.length).toBeGreaterThan(0);
    const tudo = await tudoDoBanco();
    expect(tudo).not.toContain(CPF_RESP);
    expect(tudo).not.toContain(CPF_ALUNO);
  });

  it('link inventado e corpo inválido dão a mesma resposta', async () => {
    for (const payload of [{ token: 'x'.repeat(43) }, { token: 'curto' }, {}]) {
      const r = await app.inject({ method: 'POST', url: '/auth/responsavel/consultar', payload });
      expect(r.statusCode).toBe(404);
    }
  });

  it('pedido vencido some: pedido e dados do aluno são apagados e a conta fica inativa', async () => {
    const e = email('v');
    const r = await criar({ nascimento: MENOR, email: e, cpf: CPF_ALUNO, responsavel: resp() });
    expect(r.statusCode, r.body).toBe(202);
    const token = tokenDoEmail(caixa.at(-1) as Email);
    await amb.admin.query(
      "UPDATE pedido_responsavel SET expira_em = now() - interval '1 minute' WHERE confirmado_em IS NULL",
    );
    const c = await app.inject({
      method: 'POST',
      url: '/auth/responsavel/consultar',
      payload: { token },
    });
    expect(c.statusCode).toBe(404);
    const conf = await app.inject({
      method: 'POST',
      url: '/auth/responsavel/confirmar',
      payload: { token, aceites: [true, true, true] },
    });
    expect(conf.statusCode).toBe(400);
    const u = await amb.admin.query(
      'SELECT id, situacao, desativado_em FROM usuario WHERE email = $1',
      [e],
    );
    expect(u.rows[0].situacao).toBe('inativo');
    expect(u.rows[0].desativado_em).not.toBeNull();
    const d = await amb.admin.query('SELECT 1 FROM aluno_dados WHERE usuario_id = $1', [
      u.rows[0].id,
    ]);
    expect(d.rows).toHaveLength(0);
    const p = await amb.admin.query('SELECT 1 FROM pedido_responsavel WHERE usuario_id = $1', [
      u.rows[0].id,
    ]);
    expect(p.rows).toHaveLength(0);
    expect((await entrar(e)).statusCode).toBe(401);
  });
});

describe('banco', () => {
  it('o aplicativo não lê o pedido do responsável nem grava dados direto', async () => {
    await expect(amb.bancoApp.$queryRaw`SELECT * FROM pedido_responsavel`).rejects.toThrow();
    await expect(
      amb.bancoApp
        .$queryRaw`INSERT INTO aluno_dados (instituicao_id, usuario_id, nascimento) VALUES (gen_random_uuid(), gen_random_uuid(), '2000-01-01')`,
    ).rejects.toThrow();
  });
});
