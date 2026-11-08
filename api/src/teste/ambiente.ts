import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { criarBanco } from '../banco/withTenant.js';
import { migrar } from '../migrar/migrar.js';

// Ambiente dos testes de integração: banco temporário, migrações reais e dados fictícios.
// Variáveis: TESTE_URL_ADMIN (conexão do administrador) e SIESAL_APP_PASSWORD (senha do papel siesal_app).
function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} para rodar os testes de integração.`);
  return valor;
}

export type Ambiente = Awaited<ReturnType<typeof criarAmbiente>>;

export async function criarAmbiente() {
  const urlAdmin = exigir('TESTE_URL_ADMIN');
  const senhaApp = exigir('SIESAL_APP_PASSWORD');
  const nomeBanco = `siesal_teste_${randomUUID().replaceAll('-', '')}`;

  const urlDoBanco = (usuario: string | null = null, senha: string | null = null): string => {
    const url = new URL(urlAdmin);
    url.pathname = `/${nomeBanco}`;
    if (usuario) url.username = usuario;
    if (senha) url.password = senha;
    return url.toString();
  };
  const opcoesMigracao = {
    urlAdmin: urlDoBanco(),
    senhaApp,
    pastaMigracoes: fileURLToPath(new URL('../../migracoes', import.meta.url)),
    confirmaBackup: true,
  };

  const raiz = new pg.Client({ connectionString: urlAdmin });
  await raiz.connect();
  await raiz.query(`CREATE DATABASE ${nomeBanco}`);
  await raiz.end();
  await migrar(opcoesMigracao);

  // Dados fictícios criados pelo administrador (superusuário ignora a RLS)
  const admin = new pg.Client({ connectionString: urlDoBanco() });
  await admin.connect();
  const instA = randomUUID();
  const instB = randomUUID();
  const alunaA = randomUUID();
  const alunoB = randomUUID();
  await admin.query(
    "INSERT INTO instituicao (id, nome) VALUES ($1, 'Escola A (fictícia)'), ($2, 'Escola B (fictícia)')",
    [instA, instB],
  );
  await admin.query(
    `INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES
     ($1, $3, 'aluno', 'Aluna A', 'aluna@a.exemplo'), ($2, $4, 'aluno', 'Aluno B', 'aluno@b.exemplo')`,
    [alunaA, alunoB, instA, instB],
  );
  const bancoApp = criarBanco(urlDoBanco('siesal_app', senhaApp));

  return {
    admin,
    bancoApp,
    instA,
    instB,
    alunaA,
    alunoB,
    senhaApp,
    urlAdminDoBanco: urlDoBanco(),
    opcoesMigracao,
    async encerrar() {
      await bancoApp.$disconnect();
      await admin.end();
      const limpeza = new pg.Client({ connectionString: urlAdmin });
      await limpeza.connect();
      await limpeza.query(`DROP DATABASE IF EXISTS ${nomeBanco} WITH (FORCE)`);
      await limpeza.end();
    },
  };
}
