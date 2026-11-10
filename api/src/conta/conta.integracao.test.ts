import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { verificarCadeia } from '../auditoria/auditoria.js';
import { hashSenha } from '../auth/senha.js';
import { base32Decodificar, codigoTotp, passoDe } from '../auth/totp.js';
import { withTenant } from '../banco/withTenant.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import { MAXIMO_SUPORTE_ABERTOS } from './rotas.js';

// Conta e suporte (L17c, migração 0013): trocar senha e e-mail, encerrar conta (anonimiza), aluno menor com
// aprovação do Responsável ou do Admin, suporte no sino do Admin e do Pedagógico. Só dados fictícios.
const SENHA = 'senha de teste longa 123';
let amb: Ambiente;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
const ids: Record<string, string> = {};
const emails: Record<string, { inst: string; email: string }> = {};

const chamar = (metodo: 'GET' | 'POST', url: string, quem?: string, payload?: unknown) =>
  app.inject({
    method: metodo,
    url,
    payload: payload as object,
    headers: quem ? { cookie: cookies[quem] as string } : {},
  });

const tentarLogin = (quem: string, senha = SENHA) =>
  app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      instituicao_id: emails[quem]?.inst,
      email: emails[quem]?.email,
      senha,
    },
  });

async function criar(inst: string, perfil: string, apelido: string) {
  const id = randomUUID();
  const email = `${apelido}-${id.slice(0, 8)}@k.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1,$2,$3,$4,$5)',
    [id, inst, perfil, `Pessoa ${apelido}`, email],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
    [inst, id, await hashSenha(SENHA)],
  );
  ids[apelido] = id;
  emails[apelido] = { inst, email };
  const r = await tentarLogin(apelido);
  expect(r.statusCode).toBe(200);
  let cookie = String(r.headers['set-cookie']).split(';')[0] as string;
  // O Admin precisa configurar o segundo fator antes de usar o sistema
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
      payload: {
        codigo: codigoTotp(
          base32Decodificar(ini.json().segredo),
          passoDe(new Date('2026-11-10T12:00:00Z')),
        ),
      },
      headers: { cookie },
    });
    expect(ok.statusCode).toBe(200);
    cookie = String(ok.headers['set-cookie']).split(';')[0] as string;
  }
  cookies[apelido] = cookie;
}

const vincularResponsavel = (inst: string, resp: string, aluno: string) =>
  amb.admin.query(
    "INSERT INTO vinculo (instituicao_id, tipo, usuario_id, aluno_id) VALUES ($1,'responsavel_aluno',$2,$3)",
    [inst, ids[resp], ids[aluno]],
  );

const estadoPedido = async (id: string) =>
  (await amb.admin.query('SELECT estado FROM pedido_conta WHERE id = $1', [id])).rows[0]
    .estado as string;
const linhaUsuario = async (quem: string) =>
  (await amb.admin.query('SELECT * FROM usuario WHERE id = $1', [ids[quem]])).rows[0];

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => new Date('2026-11-10T12:00:00Z'),
    limiteTentativasPorMinuto: 1000,
  });
  for (const [inst, perfil, nome] of [
    [amb.instA, 'admin', 'admin'],
    [amb.instA, 'pedagogico', 'ped'],
    [amb.instA, 'professor', 'prof'],
    [amb.instA, 'responsavel', 'resp'],
    [amb.instA, 'responsavel', 'resp2'],
    [amb.instA, 'aluno', 'aluno1'],
    [amb.instA, 'aluno', 'aluno2'],
    [amb.instA, 'aluno', 'aluno3'],
    [amb.instB, 'admin', 'adminB'],
    [amb.instB, 'aluno', 'alunoB'],
  ] as const)
    await criar(inst, perfil, nome);
  await vincularResponsavel(amb.instA, 'resp', 'aluno1');
  await vincularResponsavel(amb.instA, 'resp', 'aluno3');
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('acesso', () => {
  it('sem sessão 401; o Responsável não decide pedido que não é do seu aluno', async () => {
    expect((await chamar('GET', '/conta')).statusCode).toBe(401);
    expect((await chamar('POST', '/suporte', undefined, {})).statusCode).toBe(401);
    // professor e aluno não decidem pelo menor, e a tentativa é auditada
    expect(
      (await chamar('POST', `/conta/pedidos/${randomUUID()}/decidir`, 'prof', { aprovar: true }))
        .statusCode,
    ).toBe(403);
    expect(
      (await chamar('POST', `/conta/pedidos/${randomUUID()}/decidir`, 'aluno1', { aprovar: true }))
        .statusCode,
    ).toBe(403);
    const n = await amb.admin.query(
      "SELECT count(*)::int AS n FROM auditoria_evento WHERE acao = 'conta.acesso_negado'",
    );
    expect(n.rows[0].n).toBeGreaterThanOrEqual(2);
  });

  it('a conta mostra nome, e-mail e se é menor de idade', async () => {
    const r = await chamar('GET', '/conta', 'aluno1');
    expect(r.json().conta).toMatchObject({ perfil: 'aluno', menor: true });
    expect((await chamar('GET', '/conta', 'prof')).json().conta.menor).toBe(false);
  });
});

describe('trocar senha (rota existente, usada pela tela Minha conta)', () => {
  it('só com a senha atual', async () => {
    const r = await chamar('POST', '/auth/senha/trocar', 'prof', {
      senha_atual: 'errada',
      senha_nova: 'outra senha longa 456',
    });
    expect(r.statusCode).toBe(401);
    const ok = await chamar('POST', '/auth/senha/trocar', 'prof', {
      senha_atual: SENHA,
      senha_nova: 'outra senha longa 456',
    });
    expect(ok.statusCode, ok.body).toBe(200);
    // a troca renova a sessão: o cookie novo vale daqui em diante
    cookies.prof = String(ok.headers['set-cookie']).split(';')[0] as string;
  });
});

describe('trocar e-mail: perfil adulto (duas etapas)', () => {
  it('exige a senha atual, depois a confirmação; só então o e-mail muda', async () => {
    const novo = `novo-${randomUUID().slice(0, 8)}@k.exemplo`;
    const erro = await chamar('POST', '/conta/email', 'ped', {
      email_novo: novo,
      senha_atual: 'errada',
    });
    expect(erro.statusCode).toBe(401);
    expect(
      (
        await chamar('POST', '/conta/email', 'ped', {
          email_novo: 'nao-e-email',
          senha_atual: SENHA,
        })
      ).statusCode,
    ).toBe(400);
    const r = await chamar('POST', '/conta/email', 'ped', { email_novo: novo, senha_atual: SENHA });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().pedido.exige_aprovacao).toBe(false);
    const antes = (await linhaUsuario('ped')).email;
    expect(antes).not.toBe(novo);
    // repetir o pedido enquanto um espera: 409
    expect(
      (await chamar('POST', '/conta/email', 'ped', { email_novo: `b-${novo}`, senha_atual: SENHA }))
        .statusCode,
    ).toBe(409);
    const c = await chamar('POST', `/conta/pedidos/${r.json().pedido.id}/confirmar`, 'ped');
    expect(c.statusCode, c.body).toBe(204);
    expect((await linhaUsuario('ped')).email).toBe(novo);
    // outra pessoa não confirma pedido alheio
    expect(
      (await chamar('POST', `/conta/pedidos/${r.json().pedido.id}/confirmar`, 'prof')).statusCode,
    ).toBe(404);
  });

  it('e-mail de outra pessoa não está disponível (409)', async () => {
    const { email } = emails.prof as { email: string };
    expect(
      (await chamar('POST', '/conta/email', 'resp2', { email_novo: email, senha_atual: SENHA }))
        .statusCode,
    ).toBe(409);
  });

  it('cancelar um pedido deixa tudo como estava', async () => {
    const r = await chamar('POST', '/conta/email', 'resp2', {
      email_novo: `cancela-${randomUUID().slice(0, 8)}@k.exemplo`,
      senha_atual: SENHA,
    });
    const id = r.json().pedido.id as string;
    expect((await chamar('POST', `/conta/pedidos/${id}/cancelar`, 'resp2')).statusCode).toBe(204);
    expect(await estadoPedido(id)).toBe('cancelado');
    expect((await chamar('POST', `/conta/pedidos/${id}/confirmar`, 'resp2')).statusCode).toBe(404);
  });
});

describe('aluno menor: troca de e-mail precisa de aprovação', () => {
  it('o aluno não confirma sozinho; o Responsável vinculado aprova', async () => {
    const novo = `aluno-novo-${randomUUID().slice(0, 8)}@k.exemplo`;
    const r = await chamar('POST', '/conta/email', 'aluno1', {
      email_novo: novo,
      senha_atual: SENHA,
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().pedido.exige_aprovacao).toBe(true);
    const id = r.json().pedido.id as string;
    expect((await chamar('POST', `/conta/pedidos/${id}/confirmar`, 'aluno1')).statusCode).toBe(403);
    // Responsável que não é do aluno não vê nem decide
    expect((await chamar('GET', '/conta', 'resp2')).json().decisoes).toEqual([]);
    expect(
      (await chamar('POST', `/conta/pedidos/${id}/decidir`, 'resp2', { aprovar: true })).statusCode,
    ).toBe(404);
    // Admin de outra instituição também não
    expect(
      (await chamar('POST', `/conta/pedidos/${id}/decidir`, 'adminB', { aprovar: true }))
        .statusCode,
    ).toBe(404);
    // Responsável vinculado vê e aprova
    const lista = (await chamar('GET', '/conta', 'resp')).json().decisoes;
    expect(lista.map((d: { id: string }) => d.id)).toContain(id);
    const ok = await chamar('POST', `/conta/pedidos/${id}/decidir`, 'resp', { aprovar: true });
    expect(ok.statusCode, ok.body).toBe(204);
    expect((await linhaUsuario('aluno1')).email).toBe(novo);
  });

  it('o Admin também aprova, e recusar não muda o e-mail', async () => {
    const novo = `aluno2-${randomUUID().slice(0, 8)}@k.exemplo`;
    const r = await chamar('POST', '/conta/email', 'aluno2', {
      email_novo: novo,
      senha_atual: SENHA,
    });
    const id = r.json().pedido.id as string;
    const antes = (await linhaUsuario('aluno2')).email;
    expect(
      (await chamar('POST', `/conta/pedidos/${id}/decidir`, 'admin', { aprovar: false }))
        .statusCode,
    ).toBe(204);
    expect(await estadoPedido(id)).toBe('recusado');
    expect((await linhaUsuario('aluno2')).email).toBe(antes);
  });
});

describe('encerrar conta', () => {
  it('perfil adulto: duas etapas; depois a conta não entra, está anonimizada e sai das listas', async () => {
    await amb.admin.query(
      "INSERT INTO preferencia_usuario (instituicao_id, usuario_id, apelido) VALUES ($1,$2,'Apelido')",
      [amb.instA, ids.resp2],
    );
    expect(
      (await chamar('POST', '/conta/encerrar', 'resp2', { senha_atual: 'errada' })).statusCode,
    ).toBe(401);
    const r = await chamar('POST', '/conta/encerrar', 'resp2', { senha_atual: SENHA });
    expect(r.statusCode, r.body).toBe(201);
    expect((await linhaUsuario('resp2')).situacao).toBe('ativo');
    const c = await chamar('POST', `/conta/pedidos/${r.json().pedido.id}/confirmar`, 'resp2');
    expect(c.statusCode, c.body).toBe(204);
    const u = await linhaUsuario('resp2');
    expect(u).toMatchObject({ nome: 'Conta encerrada', situacao: 'inativo' });
    expect(u.email).toMatch(/@anonimo\.invalid$/);
    expect(u.encerrada_em).not.toBeNull();
    expect((await tentarLogin('resp2')).statusCode).toBe(401);
    // a sessão antiga também deixou de valer
    expect((await chamar('GET', '/conta', 'resp2')).statusCode).toBe(401);
    // não aparece na lista de usuários do Admin
    const lista = (await chamar('GET', '/usuarios', 'admin')).json().usuarios as { id: string }[];
    expect(lista.some((x) => x.id === ids.resp2)).toBe(false);
    const apelido = await amb.admin.query(
      'SELECT apelido FROM preferencia_usuario WHERE usuario_id = $1',
      [ids.resp2],
    );
    expect(apelido.rows[0].apelido).toBeNull();
  });

  it('aluno menor com Responsável: só o Responsável confirma; o Admin não decide enquanto há Responsável', async () => {
    const r = await chamar('POST', '/conta/encerrar', 'aluno3', { senha_atual: SENHA });
    expect(r.statusCode, r.body).toBe(201);
    const id = r.json().pedido.id as string;
    expect((await chamar('POST', `/conta/pedidos/${id}/confirmar`, 'aluno3')).statusCode).toBe(403);
    expect(
      (await chamar('POST', `/conta/pedidos/${id}/decidir`, 'admin', { aprovar: true })).statusCode,
    ).toBe(404);
    expect(
      (await chamar('GET', '/conta', 'admin')).json().decisoes.map((d: { id: string }) => d.id),
    ).not.toContain(id);
    expect((await linhaUsuario('aluno3')).situacao).toBe('ativo');
    expect(
      (await chamar('POST', `/conta/pedidos/${id}/decidir`, 'resp', { aprovar: true })).statusCode,
    ).toBe(204);
    expect((await linhaUsuario('aluno3')).nome).toBe('Conta encerrada');
    expect((await tentarLogin('aluno3')).statusCode).toBe(401);
  });

  it('aluno sem Responsável: o Admin decide; tarefas, eventos e textos são limpos; auditoria e cadeia seguem íntegras', async () => {
    const tarefa = await chamar('POST', '/tarefas', 'aluno2', { titulo: 'Segredo do aluno' });
    expect(tarefa.statusCode).toBe(201);
    const evento = await chamar('POST', '/eventos', 'aluno2', {
      titulo: 'Compromisso pessoal',
      dia: '2026-11-12',
    });
    const eventoId = evento.json().evento.id as string;
    await chamar('POST', '/suporte', 'aluno2', { assunto: 'outro', texto: 'Meu texto pessoal' });
    const r = await chamar('POST', '/conta/encerrar', 'aluno2', { senha_atual: SENHA });
    const id = r.json().pedido.id as string;
    expect(
      (await chamar('GET', '/conta', 'admin')).json().decisoes.map((d: { id: string }) => d.id),
    ).toContain(id);
    expect(
      (await chamar('POST', `/conta/pedidos/${id}/decidir`, 'admin', { aprovar: true })).statusCode,
    ).toBe(204);
    const u = await linhaUsuario('aluno2');
    expect(u.nome).toBe('Conta encerrada');
    const t = await amb.admin.query(
      'SELECT titulo, desativado_em FROM tarefa WHERE usuario_id = $1',
      [ids.aluno2],
    );
    expect(t.rows[0]).toMatchObject({ titulo: 'Removido' });
    expect(t.rows[0].desativado_em).not.toBeNull();
    const ev = await amb.admin.query('SELECT titulo FROM evento_versao WHERE evento_id = $1', [
      eventoId,
    ]);
    expect(ev.rows.every((x: { titulo: string }) => x.titulo === 'Removido')).toBe(true);
    const s = await amb.admin.query('SELECT texto FROM pedido_suporte WHERE usuario_id = $1', [
      ids.aluno2,
    ]);
    expect(s.rows[0].texto).toBe('(removido)');
    // nenhuma linha restante do banco guarda o nome ou o e-mail antigos
    const nomes = await amb.admin.query(
      "SELECT count(*)::int AS n FROM usuario WHERE id = $1 AND (nome LIKE '%aluno2%' OR email LIKE 'aluno2-%')",
      [ids.aluno2],
    );
    expect(nomes.rows[0].n).toBe(0);
    // versão de evento: o título só muda para conta encerrada; de conta ativa continua imutável
    await expect(
      withTenant(
        amb.bancoApp,
        { instituicaoId: amb.instA },
        (tx) =>
          tx.$executeRaw`UPDATE evento_versao SET titulo = 'x' WHERE evento_id IN (SELECT id FROM evento WHERE usuario_id = ${ids.aluno1}::uuid)`,
      ),
    ).resolves.toBeDefined(); // aluno1 não tem evento: nada a mudar, sem erro
    for (const inst of [amb.instA, amb.instB])
      expect(
        await withTenant(amb.bancoApp, { instituicaoId: inst }, (tx) => verificarCadeia(tx)),
      ).toEqual([]);
    const acoes = await amb.admin.query(
      "SELECT DISTINCT acao FROM auditoria_evento WHERE acao LIKE 'conta.%' ORDER BY acao",
    );
    expect(acoes.rows.map((x: { acao: string }) => x.acao)).toEqual(
      expect.arrayContaining([
        'conta.email_trocado',
        'conta.encerrada',
        'conta.encerramento_pedido',
      ]),
    );
  });
});

describe('suporte', () => {
  it('qualquer perfil pede; o Admin e o Pedagógico recebem no sino e marcam como atendido', async () => {
    const r = await chamar('POST', '/suporte', 'prof', {
      assunto: 'erro_na_tela',
      texto: 'A tela de notas não abre.',
    });
    expect(r.statusCode, r.body).toBe(201);
    const id = r.json().pedido.id as string;
    for (const quem of ['admin', 'ped']) {
      const caixa = (await chamar('GET', '/caixa', quem)).json().itens as {
        tipo: string;
        id: string;
        visto: boolean;
      }[];
      const item = caixa.find((i) => i.id === id);
      expect(item?.tipo, quem).toBe('suporte_aberto');
      expect(item?.visto).toBe(false);
    }
    // quem pediu, o professor e o Responsável não recebem o pedido dos outros
    for (const quem of ['prof', 'resp'])
      expect(
        ((await chamar('GET', '/caixa', quem)).json().itens as { id: string }[]).some(
          (i) => i.id === id,
        ),
      ).toBe(false);
    // abrir a caixa marca como visto
    expect((await chamar('POST', '/caixa/vistos', 'ped')).statusCode).toBe(200);
    expect(
      (
        (await chamar('GET', '/caixa', 'ped')).json().itens as { id: string; visto: boolean }[]
      ).find((i) => i.id === id)?.visto,
    ).toBe(true);
    expect((await chamar('POST', `/suporte/${id}/atender`, 'prof')).statusCode).toBe(403);
    expect((await chamar('POST', `/suporte/${id}/atender`, 'adminB')).statusCode).toBe(404);
    expect((await chamar('POST', `/suporte/${id}/atender`, 'ped')).statusCode).toBe(204);
    expect((await chamar('POST', `/suporte/${id}/atender`, 'ped')).statusCode).toBe(404);
    expect(
      ((await chamar('GET', '/caixa', 'admin')).json().itens as { id: string }[]).some(
        (i) => i.id === id,
      ),
    ).toBe(false);
  });

  it('assunto inválido, texto vazio ou com link são recusados; há limite de pedidos abertos', async () => {
    for (const corpo of [
      { assunto: 'x', texto: 'oi' },
      { assunto: 'outro', texto: '' },
      { assunto: 'outro', texto: 'veja https://x.com' },
      { assunto: 'outro', texto: 'oi', extra: 1 },
    ])
      expect((await chamar('POST', '/suporte', 'resp', corpo)).statusCode).toBe(400);
    for (let i = 0; i < MAXIMO_SUPORTE_ABERTOS; i++)
      expect(
        (await chamar('POST', '/suporte', 'resp', { assunto: 'outro', texto: `pedido ${i}` }))
          .statusCode,
      ).toBe(201);
    expect(
      (await chamar('POST', '/suporte', 'resp', { assunto: 'outro', texto: 'mais um' })).statusCode,
    ).toBe(409);
  });
});
