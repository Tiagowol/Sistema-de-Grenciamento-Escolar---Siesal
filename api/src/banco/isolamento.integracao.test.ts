import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrar } from '../migrar/migrar.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import { withTenant } from './withTenant.js';

// Suíte de isolamento entre instituições (Lote 3, item 3). Usa um banco temporário e as migrações reais.
let amb: Ambiente;
let instA: string;
let instB: string;
let alunaA: string;
let alunoB: string;
const banco = () => amb.bancoApp;
const admin = () => amb.admin;

beforeAll(async () => {
  amb = await criarAmbiente();
  ({ instA, instB, alunaA, alunoB } = amb);
});

afterAll(async () => {
  await amb?.encerrar();
});

describe('papel da aplicação', () => {
  it('não é superusuário e não ignora a RLS', async () => {
    const linhas = await banco().$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(linhas[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('toda tabela do esquema tem RLS ativa e forçada', async () => {
    const tabelas = await admin().query(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_migracoes'`,
    );
    expect(tabelas.rows.length).toBeGreaterThan(0);
    for (const t of tabelas.rows) {
      expect(t.relrowsecurity, `RLS ativa em ${t.relname}`).toBe(true);
      expect(t.relforcerowsecurity, `RLS forçada em ${t.relname}`).toBe(true);
    }
  });
});

describe('isolamento entre instituições A e B', () => {
  it('A lê só os próprios usuários', async () => {
    const usuarios = await withTenant(banco(), { instituicaoId: instA }, (tx) =>
      tx.usuario.findMany(),
    );
    expect(usuarios.map((u) => u.id)).toEqual([alunaA]);
  });

  it('A não encontra um usuário de B nem pelo id', async () => {
    const achado = await withTenant(banco(), { instituicaoId: instA }, (tx) =>
      tx.usuario.findFirst({ where: { id: alunoB } }),
    );
    expect(achado).toBeNull();
  });

  it('A vê só a própria instituição', async () => {
    const instituicoes = await withTenant(banco(), { instituicaoId: instA }, (tx) =>
      tx.instituicao.findMany(),
    );
    expect(instituicoes.map((i) => i.id)).toEqual([instA]);
  });

  it('A não consegue gravar usuário na instituição B', async () => {
    await expect(
      withTenant(banco(), { instituicaoId: instA }, (tx) =>
        tx.usuario.create({
          data: { instituicao_id: instB, perfil: 'aluno', nome: 'Intruso', email: 'i@b.exemplo' },
        }),
      ),
    ).rejects.toThrow();
  });

  it('A não consegue mudar um usuário de B', async () => {
    const resultado = await withTenant(banco(), { instituicaoId: instA }, (tx) =>
      tx.usuario.updateMany({ where: { id: alunoB }, data: { nome: 'Alterado' } }),
    );
    expect(resultado.count).toBe(0);
    const intacto = await admin().query('SELECT nome FROM usuario WHERE id = $1', [alunoB]);
    expect(intacto.rows[0].nome).toBe('Aluno B');
  });

  it('A não consegue mover o próprio usuário para B', async () => {
    await expect(
      withTenant(banco(), { instituicaoId: instA }, (tx) =>
        tx.usuario.updateMany({ where: { id: alunaA }, data: { instituicao_id: instB } }),
      ),
    ).rejects.toThrow();
  });

  it('o papel da aplicação não apaga usuários nem altera instituições', async () => {
    await expect(
      withTenant(banco(), { instituicaoId: instA }, (tx) => tx.usuario.deleteMany({})),
    ).rejects.toThrow();
    await expect(
      withTenant(banco(), { instituicaoId: instA }, (tx) =>
        tx.instituicao.update({ where: { id: instA }, data: { nome: 'Outro nome' } }),
      ),
    ).rejects.toThrow();
  });
});

describe('falha fechada', () => {
  it('sem withTenant nenhuma linha é visível', async () => {
    expect(await banco().usuario.findMany()).toEqual([]);
    expect(await banco().instituicao.findMany()).toEqual([]);
  });

  it('o contexto não vaza para a consulta seguinte', async () => {
    await withTenant(banco(), { instituicaoId: instA }, (tx) => tx.usuario.findMany());
    expect(await banco().usuario.findMany()).toEqual([]);
  });

  it('transações simultâneas de A e B não se misturam', async () => {
    const resultados = await Promise.all(
      Array.from({ length: 20 }, (_, i) => {
        const instituicaoId = i % 2 === 0 ? instA : instB;
        return withTenant(banco(), { instituicaoId }, async (tx) => ({
          instituicaoId,
          vistos: (await tx.usuario.findMany()).map((u) => u.instituicao_id),
        }));
      }),
    );
    for (const r of resultados) {
      expect(r.vistos.length).toBeGreaterThan(0);
      expect(new Set(r.vistos)).toEqual(new Set([r.instituicaoId]));
    }
  });

  it('contexto inválido falha antes de consultar', async () => {
    await expect(
      withTenant(banco(), { instituicaoId: 'nao-e-uuid' }, (tx) => tx.usuario.findMany()),
    ).rejects.toThrow();
  });
});

describe('migrações', () => {
  it('rodar de novo não aplica nada e migração alterada é recusada', async () => {
    const opcoes = { ...amb.opcoesMigracao, confirmaBackup: false };
    expect(await migrar(opcoes)).toEqual([]);
    await admin().query("UPDATE _migracoes SET hash = 'adulterado' WHERE nome = '0001_base.sql'");
    await expect(migrar(opcoes)).rejects.toThrow(/alterada/);
  });
});
