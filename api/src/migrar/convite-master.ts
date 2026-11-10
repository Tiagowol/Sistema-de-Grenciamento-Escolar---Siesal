import { createHash, randomInt } from 'node:crypto';
import pg from 'pg';

// Convite de primeiro acesso do Master (L18): comando manual, roda como administrador do banco.
// O valor aparece uma vez no terminal; no banco fica só o hash. Vale 30 minutos e uma vez.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const VALIDADE_CONVITE_MINUTOS = 30;

function gerarConvite(): string {
  const grupos: string[] = [];
  for (let g = 0; g < 5; g++) {
    let grupo = '';
    for (let i = 0; i < 4; i++) grupo += ALFABETO[randomInt(ALFABETO.length)];
    grupos.push(grupo);
  }
  return grupos.join('-');
}

export async function emitirConviteMaster(urlAdmin: string, usuario: string): Promise<string> {
  const nome = usuario.trim().toLowerCase();
  const convite = gerarConvite();
  const hash = createHash('sha256').update(convite.replaceAll('-', '')).digest('hex');
  const cliente = new pg.Client({ connectionString: urlAdmin });
  await cliente.connect();
  try {
    await cliente.query('BEGIN');
    const r = await cliente.query(
      `UPDATE operator_account
          SET convite_hash = $2, convite_expira_em = now() + make_interval(mins => $3),
              falhas_seguidas = 0, bloqueado_ate = NULL, atualizado_em = now()
        WHERE lower(usuario) = $1 AND situacao IN ('pendente', 'ativo')`,
      [nome, hash, VALIDADE_CONVITE_MINUTOS],
    );
    if (r.rowCount !== 1) throw new Error('Master não encontrado ou inativo; nada foi emitido.');
    await cliente.query(
      "INSERT INTO operator_auditoria (ator, acao, alvo) VALUES ('instalacao', 'operacao.convite_emitido', $1)",
      [`master:${nome}`],
    );
    await cliente.query('COMMIT');
    return convite;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    await cliente.end();
  }
}
