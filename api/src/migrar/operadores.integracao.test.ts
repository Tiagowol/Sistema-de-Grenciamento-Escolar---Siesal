import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import { criarOperadores } from './bootstrap.js';

// Masters no banco (Lote 4, item 3)
let amb: Ambiente;
beforeAll(async () => {
  amb = await criarAmbiente();
});
afterAll(async () => {
  await amb?.encerrar();
});

describe('operator_account (Masters)', () => {
  it('o comando de instalação cria 2 vagas pendentes, sem senha', async () => {
    await criarOperadores(amb.urlAdminDoBanco, ['master_um', 'master_dois']);
    const { rows } = await amb.admin.query(
      'SELECT vaga, usuario, situacao, senha_hash FROM operator_account ORDER BY vaga',
    );
    expect(rows).toEqual([
      { vaga: 1, usuario: 'master_um', situacao: 'pendente', senha_hash: null },
      { vaga: 2, usuario: 'master_dois', situacao: 'pendente', senha_hash: null },
    ]);
  });

  it('não roda de novo nem aceita nomes repetidos ou inválidos', async () => {
    await expect(criarOperadores(amb.urlAdminDoBanco, ['outro_um', 'outro_dois'])).rejects.toThrow(
      /Já existem/,
    );
    await expect(criarOperadores(amb.urlAdminDoBanco, ['mesmo', 'MESMO'])).rejects.toThrow(
      /diferentes/,
    );
    await expect(criarOperadores(amb.urlAdminDoBanco, ['a', 'b c'])).rejects.toThrow(/inválidos/);
  });

  it('terceira conta e vaga repetida são recusadas pelo banco', async () => {
    await expect(
      amb.admin.query("INSERT INTO operator_account (vaga, usuario) VALUES (1, 'intruso')"),
    ).rejects.toThrow();
    await expect(
      amb.admin.query("INSERT INTO operator_account (vaga, usuario) VALUES (3, 'terceiro')"),
    ).rejects.toThrow();
  });

  it('desativar um Master libera a vaga para um substituto', async () => {
    await amb.admin.query(
      "UPDATE operator_account SET situacao = 'inativo', desativado_em = now() WHERE vaga = 2",
    );
    await amb.admin.query("INSERT INTO operator_account (vaga, usuario) VALUES (2, 'substituto')");
    const { rows } = await amb.admin.query(
      "SELECT count(*)::int AS vivos FROM operator_account WHERE situacao <> 'inativo'",
    );
    expect(rows[0].vivos).toBe(2);
  });

  it('o papel da aplicação não acessa a tabela dos Masters', async () => {
    await expect(amb.bancoApp.$queryRaw`SELECT * FROM operator_account`).rejects.toThrow();
  });
});

describe('papel de operação (siesal_ops)', () => {
  async function comoOperacao<T>(sql: string): Promise<T> {
    await amb.admin.query('BEGIN');
    try {
      await amb.admin.query('SET LOCAL ROLE siesal_ops');
      const r = await amb.admin.query(sql);
      return r.rows as T;
    } finally {
      await amb.admin.query('ROLLBACK');
    }
  }

  it('cria e lê instituições', async () => {
    await amb.admin.query('BEGIN');
    await amb.admin.query('SET LOCAL ROLE siesal_ops');
    await amb.admin.query("INSERT INTO instituicao (nome) VALUES ('Escola C (fictícia)')");
    const { rows } = await amb.admin.query('SELECT count(*)::int AS total FROM instituicao');
    await amb.admin.query('ROLLBACK');
    expect(rows[0].total).toBe(3);
  });

  it('não lê nenhuma tabela escolar', async () => {
    for (const tabela of ['usuario', 'auditoria_evento']) {
      await expect(comoOperacao(`SELECT * FROM ${tabela}`), tabela).rejects.toThrow(
        /permission denied/,
      );
    }
  });
});
