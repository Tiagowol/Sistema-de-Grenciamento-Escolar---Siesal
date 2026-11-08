import pg from 'pg';

const USUARIO_VALIDO = /^[a-z0-9_]{3,32}$/;

// Comando de instalação: cria as 2 vagas de Master como "pendente", sem senha (ADR-004).
// A senha é definida no primeiro acesso (Lote 5). Recusa rodar se já existir algum operador.
export async function criarOperadores(urlAdmin: string, usuarios: [string, string]): Promise<void> {
  const [um, dois] = usuarios.map((u) => u.trim().toLowerCase());
  if (!um || !dois || !USUARIO_VALIDO.test(um) || !USUARIO_VALIDO.test(dois)) {
    throw new Error('Nomes de usuário inválidos: use 3 a 32 letras minúsculas, números ou "_".');
  }
  if (um === dois) throw new Error('Os dois Masters precisam ter nomes de usuário diferentes.');

  const cliente = new pg.Client({ connectionString: urlAdmin });
  await cliente.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query('SELECT count(*)::int AS total FROM operator_account');
    if (rows[0].total > 0) throw new Error('Já existem operadores cadastrados; nada foi criado.');
    await cliente.query('INSERT INTO operator_account (vaga, usuario) VALUES (1, $1), (2, $2)', [
      um,
      dois,
    ]);
    await cliente.query('COMMIT');
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    await cliente.end();
  }
}
