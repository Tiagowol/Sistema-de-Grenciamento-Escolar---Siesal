import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '../banco/withTenant.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import { registrarAuditoria, verificarCadeia } from './auditoria.js';

// Auditoria append-only com cadeia de hash (Lote 4, item 1)
let amb: Ambiente;
const banco = () => amb.bancoApp;

beforeAll(async () => {
  amb = await criarAmbiente();
});
afterAll(async () => {
  await amb?.encerrar();
});

async function gravar(
  instituicaoId: string,
  acao: string,
  extra: { antes?: unknown; depois?: unknown } = {},
) {
  await withTenant(banco(), { instituicaoId }, (tx) =>
    registrarAuditoria(tx, { instituicaoId, ator: 'sistema', acao, alvo: 'teste', ...extra }),
  );
}

describe('auditoria', () => {
  it('encadeia os eventos: cada hash_anterior é o hash do evento anterior', async () => {
    await gravar(amb.instA, 'nota.lancada', { depois: { valor: 8 } });
    await gravar(amb.instA, 'nota.alterada', {
      antes: { valor: 8 },
      depois: { valor: 9, senha: 'segredo' },
    });
    await gravar(amb.instA, 'nota.alterada');
    const eventos = await withTenant(banco(), { instituicaoId: amb.instA }, (tx) =>
      tx.auditoriaEvento.findMany({ orderBy: { seq: 'asc' } }),
    );
    expect(eventos).toHaveLength(3);
    expect(eventos[0]?.hash_anterior).toBe('');
    expect(eventos[1]?.hash_anterior).toBe(eventos[0]?.hash);
    expect(eventos[2]?.hash_anterior).toBe(eventos[1]?.hash);
    expect(eventos.every((e) => /^[0-9a-f]{64}$/.test(e.hash))).toBe(true);
    // campo sensível chegou mascarado
    expect(eventos[1]?.depois).toEqual({ valor: 9, senha: '***' });
  });

  it('cada instituição tem a própria cadeia e não enxerga a da outra', async () => {
    await gravar(amb.instB, 'usuario.criado');
    const deB = await withTenant(banco(), { instituicaoId: amb.instB }, (tx) =>
      tx.auditoriaEvento.findMany(),
    );
    expect(deB).toHaveLength(1);
    expect(deB[0]?.hash_anterior).toBe('');
  });

  it('o aplicativo não escolhe hash nem data', async () => {
    await withTenant(banco(), { instituicaoId: amb.instA }, (tx) =>
      tx.auditoriaEvento.create({
        data: {
          instituicao_id: amb.instA,
          ator: 'x',
          acao: 'forjado',
          hash: 'forjado',
          hash_anterior: 'forjado',
          criado_em: new Date(0),
        },
      }),
    );
    const ultimo = await withTenant(banco(), { instituicaoId: amb.instA }, (tx) =>
      tx.auditoriaEvento.findFirst({ where: { acao: 'forjado' } }),
    );
    expect(ultimo?.hash).not.toBe('forjado');
    expect(ultimo?.hash_anterior).not.toBe('forjado');
    expect(ultimo?.criado_em.getFullYear()).toBeGreaterThan(2000);
  });

  it('a cadeia íntegra passa na verificação', async () => {
    const problemas = await withTenant(banco(), { instituicaoId: amb.instA }, (tx) =>
      verificarCadeia(tx),
    );
    expect(problemas).toEqual([]);
  });

  it('o papel da aplicação não altera, apaga nem esvazia a auditoria', async () => {
    await expect(
      withTenant(banco(), { instituicaoId: amb.instA }, (tx) =>
        tx.auditoriaEvento.updateMany({ data: { acao: 'x' } }),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(banco(), { instituicaoId: amb.instA }, (tx) => tx.auditoriaEvento.deleteMany({})),
    ).rejects.toThrow();
    await expect(banco().$executeRaw`TRUNCATE auditoria_evento`).rejects.toThrow();
  });

  it('nem o administrador altera ou apaga pelo caminho normal (gatilho)', async () => {
    await expect(amb.admin.query("UPDATE auditoria_evento SET acao = 'x'")).rejects.toThrow(
      /append-only/,
    );
    await expect(amb.admin.query('DELETE FROM auditoria_evento')).rejects.toThrow(/append-only/);
    await expect(amb.admin.query('TRUNCATE auditoria_evento')).rejects.toThrow(/append-only/);
  });

  it('adulteração feita fora do caminho normal é detectada pela verificação', async () => {
    // Simula um superusuário que desliga os gatilhos e altera um evento
    await amb.admin.query('SET session_replication_role = replica');
    await amb.admin.query(
      "UPDATE auditoria_evento SET depois = '{\"valor\": 10}' WHERE acao = 'nota.lancada'",
    );
    await amb.admin.query('SET session_replication_role = DEFAULT');
    const problemas = await withTenant(banco(), { instituicaoId: amb.instA }, (tx) =>
      verificarCadeia(tx),
    );
    expect(problemas.length).toBeGreaterThan(0);
    expect(problemas.map((p) => p.problema)).toContain('hash');
  });

  it('remover um evento do meio é detectado', async () => {
    await amb.admin.query('SET session_replication_role = replica');
    await amb.admin.query(
      "DELETE FROM auditoria_evento WHERE acao = 'nota.alterada' AND antes IS NOT NULL",
    );
    await amb.admin.query('SET session_replication_role = DEFAULT');
    const problemas = await withTenant(banco(), { instituicaoId: amb.instA }, (tx) =>
      verificarCadeia(tx),
    );
    expect(problemas.map((p) => p.problema)).toContain('hash_anterior');
  });

  it('gravações simultâneas na mesma instituição não bifurcam a cadeia', async () => {
    await Promise.all(Array.from({ length: 10 }, (_, i) => gravar(amb.instB, `simultaneo.${i}`)));
    const eventos = await withTenant(banco(), { instituicaoId: amb.instB }, (tx) =>
      tx.auditoriaEvento.findMany({ orderBy: { seq: 'asc' } }),
    );
    for (let i = 1; i < eventos.length; i++)
      expect(eventos[i]?.hash_anterior).toBe(eventos[i - 1]?.hash);
    expect(
      await withTenant(banco(), { instituicaoId: amb.instB }, (tx) => verificarCadeia(tx)),
    ).toEqual([]);
  });
});
