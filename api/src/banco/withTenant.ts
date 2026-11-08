import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { type Prisma, PrismaClient } from '../gerado/prisma/client.js';

// Cliente do banco para o papel siesal_app (sem BYPASSRLS). A URL vem do ambiente, nunca do código.
export function criarBanco(urlConexao: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: urlConexao }) });
}

export type Contexto = { instituicaoId: string };
export type ClienteTransacao = Prisma.TransactionClient;

const esquemaUuid = z.uuid();

// Única porta de acesso a dados escolares (ADR-002/003): abre uma transação, define a instituição
// só dentro dela (set_config local) e executa a função. Contexto inválido falha antes de tocar no banco.
export async function withTenant<T>(
  banco: Pick<PrismaClient, '$transaction'>,
  contexto: Contexto,
  funcao: (tx: ClienteTransacao) => Promise<T>,
): Promise<T> {
  const instituicaoId = esquemaUuid.parse(contexto.instituicaoId);
  return banco.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.instituicao_id', ${instituicaoId}, true)`;
    return funcao(tx);
  });
}
