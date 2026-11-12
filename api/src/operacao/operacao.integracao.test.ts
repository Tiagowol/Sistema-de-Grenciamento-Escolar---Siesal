import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { hashSenha } from '../auth/senha.js';
import { base32Decodificar, codigoTotp, passoDe } from '../auth/totp.js';
import { criarOperadores } from '../migrar/bootstrap.js';
import { emitirConviteMaster } from '../migrar/convite-master.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import { COOKIE_OPERACAO } from './rotas.js';
import { comoOperacao, FALHA_OPERACAO } from './servico.js';

// L18: login dos Masters (/operacao), painel mínimo e isolamento do dado escolar. Dados fictícios.
const SENHA = 'senha ficticia do master 123';
const SENHA_ESCOLAR = 'senha de teste longa 123';
const SEGREDO_APP = 'segredo-de-teste-com-mais-de-32-caracteres!';
let amb: Ambiente;
let relogio = new Date('2026-11-10T12:00:00Z');
let app: FastifyInstance;
let cookieMaster = '';
let segredoTotp = '';
let professora: { id: string; email: string };

const avancar = (segundos: number) => {
  relogio = new Date(relogio.getTime() + segundos * 1000);
};
const cookieDe = (resposta: { headers: Record<string, unknown> }): string =>
  String(resposta.headers['set-cookie']).split(';')[0] as string;
const codigoAgora = () => codigoTotp(base32Decodificar(segredoTotp), passoDe(relogio));
const post = (url: string, payload?: unknown, cookie?: string) =>
  app.inject({
    method: 'POST',
    url,
    payload: payload as object,
    headers: cookie ? { cookie } : {},
  });
const get = (url: string, cookie?: string) =>
  app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });
const entrarEscola = () =>
  post('/auth/login', { instituicao_id: amb.instA, email: professora.email, senha: SENHA_ESCOLAR });

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: SEGREDO_APP,
    agora: () => relogio,
    limiteTentativasPorMinuto: 1000,
  });
  await criarOperadores(amb.urlAdminDoBanco, ['master_um', 'master_dois']);
  const id = randomUUID();
  professora = { id, email: `prof-${id.slice(0, 8)}@a.exemplo` };
  await amb.admin.query(
    "INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1, $2, 'professor', 'Professora Fictícia', $3)",
    [id, amb.instA, professora.email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1, $2, $3)',
    [amb.instA, id, await hashSenha(SENHA_ESCOLAR)],
  );
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('primeiro acesso do Master', () => {
  it('sem senha definida ninguém entra, e sem convite a senha não é definida', async () => {
    const login = await post('/operacao/login', { usuario: 'master_um', senha: SENHA });
    expect(login.statusCode).toBe(401);
    expect(login.json().erro).toBe(FALHA_OPERACAO);
    const semConvite = await post('/operacao/primeiro-acesso', {
      usuario: 'master_um',
      convite: 'AAAA-AAAA-AAAA-AAAA-AAAA',
      senha_nova: SENHA,
    });
    expect(semConvite.statusCode).toBe(401);
  });

  it('convite errado ou vencido é recusado; senha curta também', async () => {
    // A validade do convite usa o relógio do banco: alinhar o relógio do teste com o real
    relogio = new Date();
    const convite = await emitirConviteMaster(amb.urlAdminDoBanco, 'master_um');
    const errado = await post('/operacao/primeiro-acesso', {
      usuario: 'master_um',
      convite: 'BBBB-BBBB-BBBB-BBBB-BBBB',
      senha_nova: SENHA,
    });
    expect(errado.statusCode).toBe(401);
    const curta = await post('/operacao/primeiro-acesso', {
      usuario: 'master_um',
      convite,
      senha_nova: 'curta',
    });
    expect(curta.statusCode).toBe(400);
    avancar(31 * 60);
    const vencido = await post('/operacao/primeiro-acesso', {
      usuario: 'master_um',
      convite,
      senha_nova: SENHA,
    });
    expect(vencido.statusCode).toBe(401);
  });

  it('com convite válido define a senha, mas só entra no painel depois do TOTP', async () => {
    // O banco de teste usa o relógio real para a validade do convite: alinhar o relógio do teste
    relogio = new Date();
    const convite = await emitirConviteMaster(amb.urlAdminDoBanco, 'master_um');
    const r = await post('/operacao/primeiro-acesso', {
      usuario: 'Master_Um',
      convite: convite.toLowerCase(),
      senha_nova: SENHA,
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ nivel: 'configurar_totp', usuario: 'master_um' });
    const bruto = String(r.headers['set-cookie']);
    expect(bruto).toContain(`${COOKIE_OPERACAO.nome}=`);
    expect(bruto).toContain('HttpOnly');
    expect(bruto).toContain('Secure');
    expect(bruto).toContain('SameSite=Strict');
    const limitado = cookieDe(r);
    expect((await get('/operacao/instituicoes', limitado)).statusCode).toBe(403);
    expect((await post('/operacao/instituicoes', { nome: 'Escola X' }, limitado)).statusCode).toBe(
      403,
    );

    // O convite vale uma vez
    const deNovo = await post('/operacao/primeiro-acesso', {
      usuario: 'master_um',
      convite,
      senha_nova: `${SENHA} outra`,
    });
    expect(deNovo.statusCode).toBe(401);

    const inicio = await post('/operacao/totp/iniciar', undefined, limitado);
    expect(inicio.statusCode).toBe(200);
    segredoTotp = inicio.json().segredo;
    expect(
      (await post('/operacao/totp/confirmar', { codigo: '000000' }, limitado)).statusCode,
    ).toBe(401);
    const confirmado = await post('/operacao/totp/confirmar', { codigo: codigoAgora() }, limitado);
    expect(confirmado.statusCode).toBe(200);
    cookieMaster = cookieDe(confirmado);
    // A sessão limitada deixa de valer; a nova é completa
    expect((await get('/operacao/eu', limitado)).statusCode).toBe(401);
    expect((await get('/operacao/eu', cookieMaster)).json()).toEqual({
      nivel: 'completo',
      usuario: 'master_um',
    });
    const { rows } = await amb.admin.query(
      "SELECT situacao, totp_ativo, convite_hash FROM operator_account WHERE usuario = 'master_um'",
    );
    expect(rows[0]).toEqual({ situacao: 'ativo', totp_ativo: true, convite_hash: null });
  });
});

describe('login do Master', () => {
  it('TOTP é obrigatório: sem código não entra, código errado não entra', async () => {
    avancar(60);
    const semCodigo = await post('/operacao/login', { usuario: 'master_um', senha: SENHA });
    expect(semCodigo.statusCode).toBe(401);
    expect(semCodigo.json().erro).toBe('segundo_fator_necessario');
    expect(semCodigo.headers['set-cookie']).toBeUndefined();
    const errado = await post('/operacao/login', {
      usuario: 'master_um',
      senha: SENHA,
      codigo: '000000',
    });
    expect(errado.statusCode).toBe(401);
  });

  it('entra com senha e código; o mesmo código não vale duas vezes', async () => {
    avancar(60);
    const codigo = codigoAgora();
    const r = await post('/operacao/login', { usuario: 'master_um', senha: SENHA, codigo });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ nivel: 'completo', usuario: 'master_um' });
    cookieMaster = cookieDe(r);
    const repetido = await post('/operacao/login', { usuario: 'master_um', senha: SENHA, codigo });
    expect(repetido.statusCode).toBe(401);
  });

  it('usuário desconhecido e Master sem senha recebem a mesma resposta', async () => {
    for (const usuario of ['nao_existe', 'master_dois']) {
      const r = await post('/operacao/login', { usuario, senha: SENHA, codigo: '123456' });
      expect(r.statusCode, usuario).toBe(401);
      expect(r.json().erro, usuario).toBe(FALHA_OPERACAO);
    }
  });

  it('sair encerra a sessão', async () => {
    avancar(60);
    const r = await post('/operacao/login', {
      usuario: 'master_um',
      senha: SENHA,
      codigo: codigoAgora(),
    });
    const cookie = cookieDe(r);
    expect((await post('/operacao/logout', undefined, cookie)).statusCode).toBe(204);
    expect((await get('/operacao/eu', cookie)).statusCode).toBe(401);
  });
});

describe('painel mínimo: instituições', () => {
  it('lista só nome e situação; cria instituição', async () => {
    const lista = await get('/operacao/instituicoes', cookieMaster);
    expect(lista.statusCode).toBe(200);
    const instituicoes = lista.json().instituicoes as Record<string, unknown>[];
    expect(instituicoes.length).toBe(2);
    expect(Object.keys(instituicoes[0] as object).sort()).toEqual([
      'criado_em',
      'id',
      'nome',
      'situacao',
    ]);
    expect((await post('/operacao/instituicoes', { nome: '  ' }, cookieMaster)).statusCode).toBe(
      400,
    );
    const nova = await post(
      '/operacao/instituicoes',
      { nome: 'Escola C (fictícia)' },
      cookieMaster,
    );
    expect(nova.statusCode).toBe(201);
    expect(nova.json().instituicao.situacao).toBe('ativa');
  });

  it('suspender tira a escola do ar (login e sessão aberta); reativar devolve', async () => {
    const antes = await entrarEscola();
    expect(antes.statusCode).toBe(200);
    const cookieEscola = cookieDe(antes);
    expect(
      (await post(`/operacao/instituicoes/${amb.instA}/suspender`, undefined, cookieMaster))
        .statusCode,
    ).toBe(204);
    expect((await get('/auth/eu', cookieEscola)).statusCode).toBe(401);
    expect((await entrarEscola()).statusCode).toBe(401);
    expect(
      (await post(`/operacao/instituicoes/${amb.instA}/reativar`, undefined, cookieMaster))
        .statusCode,
    ).toBe(204);
    expect((await get('/auth/eu', cookieEscola)).statusCode).toBe(200);
    expect((await entrarEscola()).statusCode).toBe(200);
    expect(
      (await post(`/operacao/instituicoes/${randomUUID()}/suspender`, undefined, cookieMaster))
        .statusCode,
    ).toBe(404);
  });
});

describe('isolamento: Master sem dado escolar, escola sem /operacao', () => {
  // L20: instituicao_modulo é configuração da plataforma (módulos ligados por escola), não dado escolar.
  // 20c-1: convite_individual também (só hash do código, criador e datas; nenhuma pessoa).
  // L22a-1c: configuracao_plataforma também (ajustes do Master, como o limite de alunos por representante).
  it('como siesal_ops, toda tabela escolar responde "permission denied"', async () => {
    const { rows } = await amb.admin.query(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND c.relname NOT IN ('instituicao', 'instituicao_modulo', 'operator_account', 'operator_sessao', 'operator_auditoria', 'convite_individual', 'configuracao_plataforma')`,
    );
    expect(rows.length).toBeGreaterThan(20);
    for (const { relname } of rows as { relname: string }[]) {
      await expect(
        comoOperacao(amb.bancoApp, (tx) =>
          tx.$queryRawUnsafe(`SELECT 1 FROM "${relname}" LIMIT 1`),
        ),
        relname,
      ).rejects.toThrow(/permission denied/);
    }
  });

  it('o papel de operação não vira outro papel nem ganha privilégio', async () => {
    const linhas = await comoOperacao(
      amb.bancoApp,
      (tx) =>
        tx.$queryRaw<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }[]>`
        SELECT current_user::text, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
    );
    expect(linhas[0]).toEqual({ current_user: 'siesal_ops', rolsuper: false, rolbypassrls: false });
    await expect(
      comoOperacao(amb.bancoApp, (tx) => tx.$executeRawUnsafe('SET LOCAL ROLE siesal_owner')),
    ).rejects.toThrow();
  });

  it('fora do SET ROLE, o papel da aplicação não lê as tabelas dos Masters, e o papel não vaza', async () => {
    await comoOperacao(amb.bancoApp, (tx) => tx.$queryRaw`SELECT 1`);
    for (const tabela of ['operator_account', 'operator_sessao', 'operator_auditoria']) {
      await expect(
        amb.bancoApp.$queryRawUnsafe(`SELECT 1 FROM ${tabela} LIMIT 1`),
        tabela,
      ).rejects.toThrow(/permission denied/);
    }
    const atual = await amb.bancoApp.$queryRaw<{ u: string }[]>`SELECT current_user::text AS u`;
    expect(atual[0]?.u).toBe('siesal_app');
  });

  it('cookie da escola não entra em /operacao; cookie do Master não entra na escola', async () => {
    const escola = cookieDe(await entrarEscola());
    const valorEscola = escola.split('=')[1] as string;
    for (const cookie of [escola, `${COOKIE_OPERACAO.nome}=${valorEscola}`]) {
      expect((await get('/operacao/eu', cookie)).statusCode).toBe(401);
      expect((await get('/operacao/instituicoes', cookie)).statusCode).toBe(401);
      expect((await post('/operacao/instituicoes', { nome: 'Intrusa' }, cookie)).statusCode).toBe(
        401,
      );
    }
    const valorMaster = cookieMaster.split('=')[1] as string;
    for (const cookie of [cookieMaster, `__Host-siesal_sessao=${valorMaster}`]) {
      for (const rota of ['/auth/eu', '/usuarios', '/turmas', '/notas-oficiais', '/eventos']) {
        expect((await get(rota, cookie)).statusCode, rota).toBe(401);
      }
    }
    expect((await get('/operacao/instituicoes')).statusCode).toBe(401);
  });
});

describe('trilha do Master', () => {
  it('registra as ações, sem senha, convite ou código, e a cadeia confere', async () => {
    const { rows } = await amb.admin.query(
      'SELECT acao, detalhe::text AS d FROM operator_auditoria',
    );
    const acoes = rows.map((l: { acao: string }) => l.acao);
    for (const acao of [
      'operacao.convite_emitido',
      'operacao.senha_definida',
      'operacao.totp_ativado',
      'operacao.login_ok',
      'operacao.login_falhou',
      'operacao.logout',
      'instituicao.criada',
      'instituicao.suspensa',
      'instituicao.reativada',
    ]) {
      expect(acoes, acao).toContain(acao);
    }
    const tudo = JSON.stringify(rows);
    expect(tudo).not.toContain(SENHA);
    expect(tudo).not.toContain(segredoTotp);
    const problemas = await comoOperacao(
      amb.bancoApp,
      (tx) => tx.$queryRaw<unknown[]>`SELECT * FROM operator_auditoria_verificar()`,
    );
    expect(problemas).toEqual([]);
  });

  it('é append-only: alterar e apagar são recusados, até para o papel de operação', async () => {
    await expect(
      comoOperacao(amb.bancoApp, (tx) => tx.$executeRaw`UPDATE operator_auditoria SET acao = 'x'`),
    ).rejects.toThrow();
    await expect(
      comoOperacao(amb.bancoApp, (tx) => tx.$executeRaw`DELETE FROM operator_auditoria`),
    ).rejects.toThrow();
    await expect(amb.admin.query("UPDATE operator_auditoria SET acao = 'x'")).rejects.toThrow(
      /append-only/,
    );
  });

  it('a ação do Master não entra na auditoria escolar', async () => {
    const { rows } = await amb.admin.query(
      "SELECT count(*)::int AS total FROM auditoria_evento WHERE ator LIKE 'master:%' OR acao LIKE 'operacao.%'",
    );
    expect(rows[0].total).toBe(0);
  });
});

describe('bloqueio e limite por tentativas', () => {
  it('5 senhas erradas bloqueiam por 15 minutos, mesmo com a senha certa', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await post('/operacao/login', { usuario: 'master_um', senha: 'senha errada 123' });
      expect(r.statusCode).toBe(401);
    }
    avancar(60);
    const bloqueado = await post('/operacao/login', {
      usuario: 'master_um',
      senha: SENHA,
      codigo: codigoAgora(),
    });
    expect(bloqueado.statusCode).toBe(401);
    expect(bloqueado.json().erro).toBe(FALHA_OPERACAO);
    avancar(16 * 60);
    const liberado = await post('/operacao/login', {
      usuario: 'master_um',
      senha: SENHA,
      codigo: codigoAgora(),
    });
    expect(liberado.statusCode).toBe(200);
  });

  it('passou do limite por minuto: 429 e nada é processado', async () => {
    const restrito = criarApp({
      banco: amb.bancoApp,
      authSecret: SEGREDO_APP,
      agora: () => relogio,
      limiteTentativasPorMinuto: 2,
    });
    const tentar = () =>
      restrito.inject({
        method: 'POST',
        url: '/operacao/login',
        payload: { usuario: 'nao_existe', senha: 'x' },
      });
    expect((await tentar()).statusCode).toBe(401);
    expect((await tentar()).statusCode).toBe(401);
    expect((await tentar()).statusCode).toBe(429);
    await restrito.close();
  });
});
