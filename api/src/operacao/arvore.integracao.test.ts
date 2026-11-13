import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { hashSenha } from '../auth/senha.js';
import { base32Decodificar, codigoTotp, passoDe } from '../auth/totp.js';
import { criarOperadores } from '../migrar/bootstrap.js';
import { emitirConviteMaster } from '../migrar/convite-master.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import { comoOperacao } from './servico.js';

// L22b (migração 0031): árvore do Master, só leitura. Só nome, e-mail, área, situação e menor/maior. Dados fictícios.
const SENHA_MASTER = 'senha ficticia do master 123';
const SENHA = 'senha de teste longa 123';
let amb: Ambiente;
let app: FastifyInstance;
let master = '';
let alunoCookie = '';
let espacoId = '';
const ids: Record<string, string> = {};

const chamar = (
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
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

async function usuario(
  inst: string,
  perfil: string,
  nome: string,
  extra?: { nasc?: string; inativo?: boolean },
) {
  const id = randomUUID();
  const email = `${nome.toLowerCase().replace(/[^a-z]/g, '')}-${id.slice(0, 6)}@l22b.exemplo`;
  await amb.admin.query(
    'INSERT INTO usuario (id, instituicao_id, perfil, nome, email, situacao) VALUES ($1,$2,$3,$4,$5,$6)',
    [id, inst, perfil, nome, email, extra?.inativo ? 'inativo' : 'ativo'],
  );
  if (extra?.nasc)
    await amb.admin.query(
      'INSERT INTO aluno_dados (instituicao_id, usuario_id, nascimento) VALUES ($1,$2,$3)',
      [inst, id, extra.nasc],
    );
  ids[nome] = id;
  return { id, email };
}

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => new Date(),
    limiteTentativasPorMinuto: 1000,
  });
  await criarOperadores(amb.urlAdminDoBanco, ['master_l22b', 'master_l22c']);
  const convite = await emitirConviteMaster(amb.urlAdminDoBanco, 'master_l22b');
  const r = await app.inject({
    method: 'POST',
    url: '/operacao/primeiro-acesso',
    payload: { usuario: 'master_l22b', convite, senha_nova: SENHA_MASTER },
  });
  const limitado = cookieDe(r);
  const ini = await chamar('POST', '/operacao/totp/iniciar', limitado, {});
  const ok = await chamar('POST', '/operacao/totp/confirmar', limitado, {
    codigo: codigoTotp(base32Decodificar(ini.json().segredo), passoDe(new Date())),
  });
  expect(ok.statusCode).toBe(200);
  master = cookieDe(ok);

  // Escola A: Admin, professor, pedagógico, aluno menor, aluno maior e um aluno desativado
  await usuario(amb.instA, 'admin', 'Admin Fictício');
  await usuario(amb.instA, 'professor', 'Professora Fictícia');
  await usuario(amb.instA, 'pedagogico', 'Pedagoga Fictícia');
  const menor = await usuario(amb.instA, 'aluno', 'Aluno Menor Fictício', { nasc: '2015-03-10' });
  await usuario(amb.instA, 'aluno', 'Aluno Maior Fictício', { nasc: '1999-01-01' });
  await usuario(amb.instA, 'aluno', 'Aluno Inativo Fictício', {
    nasc: '2014-01-01',
    inativo: true,
  });
  // O aluno menor tem nota, tarefa e CPF: nada disso pode aparecer na árvore
  await amb.admin.query(
    "INSERT INTO tarefa (instituicao_id, usuario_id, titulo, tipo) VALUES ($1,$2,'Tarefa Secreta Zeta','tarefa')",
    [amb.instA, menor.id],
  );
  await amb.admin.query(
    "UPDATE aluno_dados SET cpf_cifrado = 'x', cpf_hmac = 'y', cpf_final = '42' WHERE instituicao_id = $1 AND usuario_id = $2",
    [amb.instA, menor.id],
  );
  await amb.admin.query(
    'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES ($1,$2,$3)',
    [amb.instA, menor.id, await hashSenha(SENHA)],
  );
  const l = await chamar('POST', '/auth/login', undefined, {
    instituicao_id: amb.instA,
    email: menor.email,
    senha: SENHA,
  });
  alunoCookie = cookieDe(l);

  // Espaço individual: um aluno menor com o Responsável legal
  espacoId = randomUUID();
  await amb.admin.query(
    "INSERT INTO instituicao (id, nome, tipo) VALUES ($1, 'Espaço individual', 'individual')",
    [espacoId],
  );
  await usuario(espacoId, 'aluno', 'Aluno Isolado Fictício', { nasc: '2014-05-05' });
  await usuario(espacoId, 'responsavel', 'Responsável Fictício');
  // Pessoa sem vínculo (só conta, sem nenhum usuário)
  await amb.admin.query(
    "INSERT INTO pessoa (nome, email, papel_desejado) VALUES ('Pessoa Sem Vinculo Fictícia', 'semvinculo@l22b.exemplo', 'professor')",
  );
});
afterAll(async () => {
  await app?.close();
  await amb?.encerrar();
});

describe('L22b: acesso à árvore', () => {
  it('sem Master = 401; a sessão da escola não abre a árvore', async () => {
    for (const url of [
      `/operacao/arvore/instituicao/${amb.instA}`,
      '/operacao/arvore/espacos',
      '/operacao/arvore/sem-vinculo',
    ]) {
      expect((await chamar('GET', url)).statusCode, url).toBe(401);
      expect((await chamar('GET', url, alunoCookie)).statusCode, url).toBe(401);
    }
  });

  it('não existe nenhuma rota de escrita na árvore', async () => {
    for (const metodo of ['POST', 'PATCH', 'PUT', 'DELETE'] as const)
      for (const url of [
        `/operacao/arvore/instituicao/${amb.instA}`,
        '/operacao/arvore/espacos',
        '/operacao/arvore/sem-vinculo',
      ])
        expect([404, 405], `${metodo} ${url}`).toContain(
          (await chamar(metodo, url, master, {})).statusCode,
        );
  });

  it('id inválido = 400; escola que não existe (ou espaço individual) = 404', async () => {
    expect((await chamar('GET', '/operacao/arvore/instituicao/xx', master)).statusCode).toBe(400);
    expect(
      (await chamar('GET', `/operacao/arvore/instituicao/${randomUUID()}`, master)).statusCode,
    ).toBe(404);
    expect(
      (await chamar('GET', `/operacao/arvore/instituicao/${espacoId}`, master)).statusCode,
    ).toBe(404);
  });
});

describe('L22b: escola', () => {
  it('lista as pessoas da escola por área, só com os campos permitidos', async () => {
    const r = await chamar('GET', `/operacao/arvore/instituicao/${amb.instA}`, master);
    expect(r.statusCode, r.body).toBe(200);
    const { pessoas, nome } = r.json();
    expect(nome).toBe('Escola A (fictícia)');
    for (const p of pessoas)
      expect(Object.keys(p).sort()).toEqual([
        'ativo',
        'email',
        'menor',
        'nome',
        'perfil',
        'usuario_id',
      ]);
    const por = (n: string) => pessoas.find((p: { nome: string }) => p.nome === n);
    expect(por('Admin Fictício')).toMatchObject({ perfil: 'admin', ativo: true, menor: null });
    expect(por('Professora Fictícia').perfil).toBe('professor');
    expect(por('Pedagoga Fictícia').perfil).toBe('pedagogico');
    expect(por('Aluno Menor Fictício')).toMatchObject({
      perfil: 'aluno',
      menor: true,
      ativo: true,
    });
    expect(por('Aluno Maior Fictício')).toMatchObject({ perfil: 'aluno', menor: false });
    expect(por('Aluno Inativo Fictício').ativo).toBe(false);
    expect(por('Admin Fictício').email).toMatch(/@l22b\.exemplo$/);
  });

  it('nunca devolve nota, tarefa, CPF, nascimento nem conteúdo; e não mistura escolas', async () => {
    const r = await chamar('GET', `/operacao/arvore/instituicao/${amb.instA}`, master);
    expect(r.body).not.toMatch(/Tarefa Secreta|cpf|nascimento|2015-03-10|senha|"42"/i);
    expect(r.body).not.toMatch(/Aluno Isolado|Responsável Fictício|Aluno B/);
    const b = await chamar('GET', `/operacao/arvore/instituicao/${amb.instB}`, master);
    expect(b.body).not.toMatch(/Admin Fictício|Aluno Menor/);
  });
});

describe('L22b: espaços individuais e sem vínculo', () => {
  it('o espaço mostra o aluno menor e o Responsável, e só isso', async () => {
    const r = await chamar('GET', '/operacao/arvore/espacos', master);
    expect(r.statusCode, r.body).toBe(200);
    const e = r.json().espacos.find((x: { espaco_id: string }) => x.espaco_id === espacoId);
    expect(e.pessoas.map((p: { nome: string }) => p.nome).sort()).toEqual([
      'Aluno Isolado Fictício',
      'Responsável Fictício',
    ]);
    expect(e.pessoas.find((p: { perfil: string }) => p.perfil === 'aluno').menor).toBe(true);
    expect(r.body).not.toMatch(/Admin Fictício|Professora/);
  });

  it('usuários sem vínculo: só conta sem usuário ativo; quem está numa escola não aparece', async () => {
    const r = await chamar('GET', '/operacao/arvore/sem-vinculo', master);
    expect(r.statusCode, r.body).toBe(200);
    const nomes = r.json().pessoas.map((p: { nome: string }) => p.nome);
    expect(nomes).toContain('Pessoa Sem Vinculo Fictícia');
    expect(nomes).not.toContain('Admin Fictício');
    expect(nomes).not.toContain('Aluno Isolado Fictício');
    for (const p of r.json().pessoas)
      expect(Object.keys(p).sort()).toEqual(['email', 'nome', 'papel_desejado', 'pessoa_id']);
  });
});

describe('L22b: auditoria e permissão do banco', () => {
  it('cada abertura vai para a trilha, sem os nomes lidos', async () => {
    await chamar('GET', `/operacao/arvore/instituicao/${amb.instA}`, master);
    await chamar('GET', '/operacao/arvore/espacos', master);
    await chamar('GET', '/operacao/arvore/sem-vinculo', master);
    const t = await chamar('GET', '/operacao/auditoria', master);
    const acoes = t.json().eventos.map((e: { acao: string }) => e.acao);
    for (const a of ['arvore.instituicao', 'arvore.espacos', 'arvore.sem_vinculo'])
      expect(acoes).toContain(a);
    expect(t.body).not.toMatch(/Fictício|@l22b\.exemplo/);
    expect(t.json().integra).toBe(true);
  });

  it('o papel do Master continua sem ler tabela escolar; só executa as 3 funções', async () => {
    for (const tabela of ['usuario', 'pessoa', 'aluno_dados', 'tarefa'])
      await expect(
        comoOperacao(amb.bancoApp, (tx) => tx.$queryRawUnsafe(`SELECT 1 FROM ${tabela} LIMIT 1`)),
        tabela,
      ).rejects.toThrow(/permission denied|permissão negada/i);
    await expect(
      comoOperacao(amb.bancoApp, (tx) => tx.$queryRawUnsafe('SELECT * FROM arvore_sem_vinculo()')),
    ).resolves.toBeDefined();
  });

  it('o app e o aluno não executam as funções da árvore', async () => {
    await expect(
      amb.bancoApp.$queryRawUnsafe('SELECT * FROM arvore_sem_vinculo()'),
    ).rejects.toThrow(/permission denied|permissão negada/i);
  });
});
