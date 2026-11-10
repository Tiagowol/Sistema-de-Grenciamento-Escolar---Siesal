import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

export type OpcoesMigracao = {
  urlAdmin: string; // conexão do administrador do banco (só o job migrate usa)
  senhaApp: string; // senha do papel siesal_app, vinda do ambiente
  pastaMigracoes: string;
  confirmaBackup: boolean; // trava: só aplica migração pendente com backup confirmado
  registrar?: (mensagem: string) => void;
};

// Cria os papéis (sem senha no código) e as permissões de esquema. Pode rodar várias vezes.
async function prepararPapeis(cliente: pg.Client, senhaApp: string): Promise<void> {
  await cliente.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'siesal_owner') THEN
        CREATE ROLE siesal_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'siesal_app') THEN
        CREATE ROLE siesal_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
      END IF;
      -- Operação da plataforma (Masters): sem login por enquanto; o login entra com a autenticação
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'siesal_ops') THEN
        CREATE ROLE siesal_ops NOLOGIN NOSUPERUSER NOBYPASSRLS;
      END IF;
    END $$`);
  await cliente.query(`ALTER ROLE siesal_app PASSWORD ${pg.escapeLiteral(senhaApp)}`);
  await cliente.query(
    `DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO siesal_app, siesal_owner, siesal_ops', current_database()); END $$`,
  );
  await cliente.query('GRANT USAGE, CREATE ON SCHEMA public TO siesal_owner');
  await cliente.query('GRANT USAGE ON SCHEMA public TO siesal_app, siesal_ops');
  // L18: a API vira siesal_ops só por SET LOCAL ROLE, dentro de uma transação. Sem herança:
  // fora desse SET ROLE, siesal_app continua sem nenhuma permissão nas tabelas dos Masters.
  await cliente.query('GRANT siesal_ops TO siesal_app WITH INHERIT FALSE, SET TRUE');
}

// Aplica as migrações SQL em ordem, cada uma em uma transação, como siesal_owner.
export async function migrar(opcoes: OpcoesMigracao): Promise<string[]> {
  const log = opcoes.registrar ?? (() => {});
  const cliente = new pg.Client({ connectionString: opcoes.urlAdmin });
  await cliente.connect();
  const aplicadas: string[] = [];
  try {
    await cliente.query(`CREATE TABLE IF NOT EXISTS _migracoes (
      nome text PRIMARY KEY, hash text NOT NULL, aplicada_em timestamptz NOT NULL DEFAULT now())`);
    const arquivos = (await readdir(opcoes.pastaMigracoes))
      .filter((a) => a.endsWith('.sql'))
      .sort();
    const jaAplicadas = new Map<string, string>();
    for (const linha of (await cliente.query('SELECT nome, hash FROM _migracoes')).rows) {
      jaAplicadas.set(linha.nome, linha.hash);
    }

    // Migração já aplicada nunca pode mudar (falha em vez de sobrescrever)
    const pendentes: { nome: string; sql: string; hash: string }[] = [];
    for (const nome of arquivos) {
      const sql = await readFile(join(opcoes.pastaMigracoes, nome), 'utf8');
      const hash = createHash('sha256').update(sql).digest('hex');
      const anterior = jaAplicadas.get(nome);
      if (anterior === undefined) pendentes.push({ nome, sql, hash });
      else if (anterior !== hash)
        throw new Error(`Migração ${nome} foi alterada depois de aplicada.`);
    }
    if (pendentes.length === 0) {
      log('migrar: nenhuma migração pendente');
      return aplicadas;
    }
    if (!opcoes.confirmaBackup) {
      throw new Error(
        'Há migração pendente. Faça o backup e rode de novo com CONFIRMA_BACKUP=sim.',
      );
    }

    await prepararPapeis(cliente, opcoes.senhaApp);
    for (const { nome, sql, hash } of pendentes) {
      await cliente.query('BEGIN');
      try {
        await cliente.query('SET LOCAL ROLE siesal_owner');
        await cliente.query(sql);
        await cliente.query('RESET ROLE');
        await cliente.query('INSERT INTO _migracoes (nome, hash) VALUES ($1, $2)', [nome, hash]);
        await cliente.query('COMMIT');
      } catch (erro) {
        await cliente.query('ROLLBACK');
        throw erro;
      }
      aplicadas.push(nome);
      log(`migrar: aplicada ${nome}`);
    }
    return aplicadas;
  } finally {
    await cliente.end();
  }
}
