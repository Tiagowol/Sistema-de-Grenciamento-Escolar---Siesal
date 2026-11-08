import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { gerarSenhaProvisoria, hashSenha } from '../auth/senha.js';

export type NovaInstituicao = { nome: string; adminNome: string; adminEmail: string };

// Comando de instalação: cria uma instituição e o primeiro admin, com senha provisória mostrada uma vez.
// Roda como administrador do banco (fora da aplicação). Só dados fictícios.
export async function criarInstituicao(
  urlAdmin: string,
  dados: NovaInstituicao,
): Promise<{ instituicaoId: string; adminId: string; senhaProvisoria: string }> {
  const nome = dados.nome.trim();
  const adminNome = dados.adminNome.trim();
  const email = dados.adminEmail.trim().toLowerCase();
  if (!nome || !adminNome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Informe nome da instituição, nome do admin e um e-mail válido.');
  }
  const senhaProvisoria = gerarSenhaProvisoria();
  const senhaHash = await hashSenha(senhaProvisoria);
  const instituicaoId = randomUUID();
  const adminId = randomUUID();

  const cliente = new pg.Client({ connectionString: urlAdmin });
  await cliente.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('INSERT INTO instituicao (id, nome) VALUES ($1, $2)', [
      instituicaoId,
      nome,
    ]);
    await cliente.query(
      "INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES ($1, $2, 'admin', $3, $4)",
      [adminId, instituicaoId, adminNome, email],
    );
    await cliente.query(
      'INSERT INTO credencial (instituicao_id, usuario_id, senha_hash, senha_provisoria) VALUES ($1, $2, $3, true)',
      [instituicaoId, adminId, senhaHash],
    );
    await cliente.query('COMMIT');
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    await cliente.end();
  }
  return { instituicaoId, adminId, senhaProvisoria };
}
