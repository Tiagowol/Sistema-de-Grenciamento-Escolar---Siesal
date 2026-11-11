import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { verificarCadeia } from '../auditoria/auditoria.js';
import { hashSenha } from '../auth/senha.js';
import { base32Decodificar, codigoTotp, passoDe } from '../auth/totp.js';
import { withTenant } from '../banco/withTenant.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// Personalização e tipos de atividade (L17b, migração 0012): preferências por usuário que sobrevivem a novo
// login, contraste mínimo, "voltar ao padrão", tipos próprios com isolamento. Só dados fictícios.
const SENHA = 'senha de teste longa 123';
let amb: Ambiente;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
const emails: Record<string, { inst: string; email: string }> = {};

const chamar = (
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
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

const login = async (quem: string) => {
  const { inst, email } = emails[quem] as { inst: string; email: string };
  const r = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { instituicao_id: inst, email, senha: SENHA },
  });
  expect(r.statusCode).toBe(200);
  cookies[quem] = String(r.headers['set-cookie']).split(';')[0] as string;
};

async function criar(inst: string, perfil: string, apelido: string) {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@p.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
    [id, inst, perfil, `Pessoa ${apelido}`, email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
    [inst, id, await hashSenha(SENHA)],
  );
  emails[apelido] = { inst, email };
  await login(apelido);
  // O Admin precisa configurar o segundo fator antes de usar o sistema
  if (perfil === 'admin') await ativarTotp(apelido);
}

async function ativarTotp(quem: string) {
  const headers = { cookie: cookies[quem] as string };
  const ini = await app.inject({ method: 'POST', url: '/auth/totp/iniciar', payload: {}, headers });
  const ok = await app.inject({
    method: 'POST',
    url: '/auth/totp/confirmar',
    payload: {
      codigo: codigoTotp(
        base32Decodificar(ini.json().segredo),
        passoDe(new Date('2026-11-10T12:00:00Z')),
      ),
    },
    headers,
  });
  expect(ok.statusCode).toBe(200);
  cookies[quem] = String(ok.headers['set-cookie']).split(';')[0] as string;
}

const PREFS = {
  apelido: 'Lu',
  cor_destaque: 'verde',
  tema: 'escuro',
  fonte: 120,
  reduzir_movimento: true,
  leitura_facilitada: false,
  modo_simples: false,
  tempo_visual: true,
  linguagem_curta: true,
  escolha_agora: true,
  tela_inicial: 'calendario',
  minutos_curto: 10,
  minutos_medio: 25,
  minutos_longo: 45,
};

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => new Date('2026-11-10T12:00:00Z'),
    limiteTentativasPorMinuto: 1000,
  });
  await criar(amb.instA, 'aluno', 'a');
  await criar(amb.instA, 'aluno', 'b');
  await criar(amb.instB, 'aluno', 'c');
  await criar(amb.instA, 'professor', 'prof');
  await criar(amb.instA, 'admin', 'adm');
  await criar(amb.instA, 'pedagogico', 'ped');
  await criar(amb.instA, 'responsavel', 'resp');
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('acesso', () => {
  it('sem sessão 401; tipos de atividade continuam só do aluno (professor 403)', async () => {
    expect((await chamar('GET', '/preferencias')).statusCode).toBe(401);
    expect((await chamar('GET', '/tipos-atividade', 'prof')).statusCode).toBe(403);
  });

  // L20a (matriz v13): os 5 perfis escolares guardam as próprias preferências na conta; cada um só vê a sua
  it('os 5 perfis gravam e leem só as próprias preferências', async () => {
    for (const quem of ['prof', 'adm', 'ped', 'resp']) {
      expect((await chamar('GET', '/preferencias', quem)).json().preferencias, quem).toBeNull();
      const r = await chamar('PUT', '/preferencias', quem, { ...PREFS, apelido: quem });
      expect(r.statusCode, `${quem} ${r.body}`).toBe(200);
      if (quem !== 'adm') await login(quem);
      expect((await chamar('GET', '/preferencias', quem)).json().preferencias.apelido).toBe(quem);
    }
    // quem não gravou continua com o padrão (nenhum vazamento entre perfis da mesma instituição)
    expect((await chamar('GET', '/preferencias', 'b')).json().preferencias).toBeNull();
  });
});

describe('preferências por usuário', () => {
  it('sem personalizar, o padrão vale (null)', async () => {
    expect((await chamar('GET', '/preferencias', 'a')).json().preferencias).toBeNull();
  });

  it('gravada em um navegador, aparece depois de novo login (outro navegador)', async () => {
    const r = await chamar('PUT', '/preferencias', 'a', PREFS);
    expect(r.statusCode, r.body).toBe(200);
    await login('a');
    expect((await chamar('GET', '/preferencias', 'a')).json().preferencias).toEqual(PREFS);
    // Outro aluno (mesma instituição) e aluno de outra instituição seguem com o padrão
    expect((await chamar('GET', '/preferencias', 'b')).json().preferencias).toBeNull();
    expect((await chamar('GET', '/preferencias', 'c')).json().preferencias).toBeNull();
  });

  it('cor ilegível no tema é recusada (422) e cor desconhecida também (400)', async () => {
    expect(
      (await chamar('PUT', '/preferencias', 'b', { ...PREFS, cor_destaque: 'amarelo' })).statusCode,
    ).toBe(400);
    expect((await chamar('PUT', '/preferencias', 'b', { ...PREFS, fonte: 200 })).statusCode).toBe(
      400,
    );
    expect(
      (await chamar('PUT', '/preferencias', 'b', { ...PREFS, apelido: 'http://x.com' })).statusCode,
    ).toBe(400);
    expect(
      (await chamar('PUT', '/preferencias', 'b', { ...PREFS, apelido: 'a@b.com' })).statusCode,
    ).toBe(400);
    expect((await chamar('PUT', '/preferencias', 'b', { ...PREFS, extra: 1 })).statusCode).toBe(
      400,
    );
  });

  it('toda cor da paleta é aceita nos 4 temas (a paleta é legível)', async () => {
    for (const cor of ['azul', 'verde', 'roxo', 'rosa', 'laranja', 'cinza'])
      for (const tema of ['claro', 'escuro', 'alto_contraste', 'alto_contraste_escuro'])
        expect(
          (await chamar('PUT', '/preferencias', 'b', { ...PREFS, cor_destaque: cor, tema }))
            .statusCode,
          `${cor} ${tema}`,
        ).toBe(200);
  });

  it('os minutos dos 3 blocos: de 5 em 5, de 5 a 120 e curto < médio < longo (L20a)', async () => {
    const ok = await chamar('PUT', '/preferencias', 'b', {
      ...PREFS,
      minutos_curto: 15,
      minutos_medio: 30,
      minutos_longo: 60,
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().preferencias).toMatchObject({
      minutos_curto: 15,
      minutos_medio: 30,
      minutos_longo: 60,
    });
    for (const [c, m, l] of [
      [12, 25, 45], // não é de 5 em 5
      [5, 25, 125], // passa de 120
      [0, 25, 45], // abaixo de 5
      [30, 25, 45], // curto maior que médio
      [10, 25, 25], // médio igual a longo
    ])
      expect(
        (
          await chamar('PUT', '/preferencias', 'b', {
            ...PREFS,
            minutos_curto: c,
            minutos_medio: m,
            minutos_longo: l,
          })
        ).statusCode,
        `${c}/${m}/${l}`,
      ).toBe(400);
    // sem os campos de minutos, o corpo é recusado (o formato é fechado)
    const { minutos_curto: _a, ...semMinutos } = PREFS;
    expect((await chamar('PUT', '/preferencias', 'b', semMinutos)).statusCode).toBe(400);
  });

  it('o banco também recusa minutos fora da regra (CHECK da migração 0018)', async () => {
    const q = await amb.admin.query(
      'SELECT instituicao_id, usuario_id FROM preferencia_usuario LIMIT 1',
    );
    const { instituicao_id: i, usuario_id: u } = q.rows[0];
    await expect(
      amb.admin.query(
        'UPDATE preferencia_usuario SET minutos_curto = 50, minutos_medio = 25 WHERE instituicao_id = $1 AND usuario_id = $2',
        [i, u],
      ),
    ).rejects.toThrow();
    await expect(
      amb.admin.query(
        "UPDATE preferencia_usuario SET tema = 'neon' WHERE instituicao_id = $1 AND usuario_id = $2",
        [i, u],
      ),
    ).rejects.toThrow();
  });

  it('"voltar ao padrão" grava os valores padrão e audita', async () => {
    await chamar('PUT', '/preferencias', 'a', PREFS);
    const r = await chamar('POST', '/preferencias/padrao', 'a');
    expect(r.statusCode).toBe(200);
    expect(r.json().preferencias).toMatchObject({
      apelido: null,
      cor_destaque: null,
      tema: 'claro',
      fonte: 100,
      tela_inicial: 'meudia',
      minutos_curto: 10,
      minutos_medio: 25,
      minutos_longo: 45,
    });
    const n = await amb.admin.query(
      "SELECT count(*)::int AS n FROM auditoria_evento WHERE acao = 'preferencias.padrao'",
    );
    expect(n.rows[0].n).toBeGreaterThanOrEqual(1);
  });
});

describe('tipos de atividade próprios', () => {
  let id: string;
  it('cria, lista e rejeita nome repetido e dados inválidos', async () => {
    const r = await chamar('POST', '/tipos-atividade', 'a', {
      nome: 'Leitura',
      cor: 'azul',
      icone: 'book',
    });
    expect(r.statusCode, r.body).toBe(201);
    id = r.json().tipo.id;
    expect(
      (
        await chamar('POST', '/tipos-atividade', 'a', {
          nome: 'leitura',
          cor: 'verde',
          icone: 'book',
        })
      ).statusCode,
    ).toBe(409);
    for (const corpo of [
      { nome: '', cor: 'azul', icone: 'book' },
      { nome: 'x', cor: 'neon', icone: 'book' },
      { nome: 'x', cor: 'azul', icone: 'foguete' },
      { nome: 'ver https://x.com', cor: 'azul', icone: 'book' },
    ])
      expect((await chamar('POST', '/tipos-atividade', 'a', corpo)).statusCode).toBe(400);
    expect((await chamar('GET', '/tipos-atividade', 'a')).json().tipos).toHaveLength(1);
  });

  it('cada aluno vê só os seus; ninguém remove o tipo de outro', async () => {
    for (const outro of ['b', 'c']) {
      expect((await chamar('GET', '/tipos-atividade', outro)).json().tipos).toEqual([]);
      expect((await chamar('DELETE', `/tipos-atividade/${id}`, outro)).statusCode).toBe(404);
    }
    // o mesmo nome pode existir para outro aluno
    expect(
      (
        await chamar('POST', '/tipos-atividade', 'b', {
          nome: 'Leitura',
          cor: 'rosa',
          icone: 'book',
        })
      ).statusCode,
    ).toBe(201);
  });

  it('vale em tarefa e em evento; tipo de outro aluno é recusado', async () => {
    const t = await chamar('POST', '/tarefas', 'a', {
      titulo: 'Ler capítulo',
      tipo_atividade_id: id,
    });
    expect(t.statusCode, t.body).toBe(201);
    expect(t.json().tarefa.tipo_atividade_id).toBe(id);
    const e = await chamar('POST', '/eventos', 'a', {
      titulo: 'Hora de leitura',
      dia: '2026-11-12',
      tipo_atividade_id: id,
    });
    expect(e.statusCode, e.body).toBe(201);
    expect(e.json().evento.tipo_atividade_id).toBe(id);
    expect(
      (await chamar('POST', '/tarefas', 'b', { titulo: 'x', tipo_atividade_id: id })).statusCode,
    ).toBe(400);
    expect(
      (
        await chamar('POST', '/eventos', 'b', {
          titulo: 'x',
          dia: '2026-11-12',
          tipo_atividade_id: id,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await chamar('PATCH', `/tarefas/${t.json().tarefa.id}`, 'b', { tipo_atividade_id: id }))
        .statusCode,
    ).toBe(404);
  });

  it('desativar tira o tipo da lista e não apaga a tarefa; o tipo desativado não pode ser usado', async () => {
    expect((await chamar('DELETE', `/tipos-atividade/${id}`, 'a')).statusCode).toBe(204);
    expect((await chamar('GET', '/tipos-atividade', 'a')).json().tipos).toEqual([]);
    expect((await chamar('GET', '/tarefas', 'a')).json().tarefas).toHaveLength(1);
    expect(
      (await chamar('POST', '/tarefas', 'a', { titulo: 'y', tipo_atividade_id: id })).statusCode,
    ).toBe(400);
    const linha = await amb.admin.query('SELECT desativado_em FROM tipo_atividade WHERE id = $1', [
      id,
    ]);
    expect(linha.rows[0].desativado_em).not.toBeNull();
  });

  it('a auditoria registra e a cadeia está íntegra', async () => {
    for (const inst of [amb.instA, amb.instB])
      expect(
        await withTenant(amb.bancoApp, { instituicaoId: inst }, (tx) => verificarCadeia(tx)),
      ).toEqual([]);
    const acoes = await amb.admin.query(
      "SELECT DISTINCT acao FROM auditoria_evento WHERE acao LIKE 'tipo_atividade.%' OR acao LIKE 'preferencias.%'",
    );
    expect(acoes.rows.map((x: { acao: string }) => x.acao).sort()).toEqual([
      'preferencias.padrao',
      'preferencias.salvas',
      'tipo_atividade.criado',
      'tipo_atividade.desativado',
    ]);
  });
});
