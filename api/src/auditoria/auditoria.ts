import type { ClienteTransacao } from '../banco/withTenant.js';
import type { Prisma } from '../gerado/prisma/client.js';

// Campos que nunca vão para a auditoria em texto claro (senha, segredo, token, código, hash)
const CAMPO_SENSIVEL = /senha|segredo|token|codigo|hash|cookie/i;

// Troca o valor dos campos sensíveis por "***", em qualquer nível do objeto
export function mascarar(valor: unknown): Prisma.InputJsonValue | undefined {
  if (valor === undefined || valor === null) return undefined;
  if (Array.isArray(valor)) return valor.map((v) => mascarar(v) ?? null);
  if (typeof valor === 'object') {
    const saida: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [chave, v] of Object.entries(valor)) {
      saida[chave] = CAMPO_SENSIVEL.test(chave) ? '***' : (mascarar(v) ?? null);
    }
    return saida;
  }
  return valor as Prisma.InputJsonValue;
}

export type EventoAuditoria = {
  instituicaoId: string;
  ator: string; // ex.: "usuario:<uuid>" ou "sistema"
  acao: string; // ex.: "nota.alterada"
  alvo?: string;
  antes?: unknown;
  depois?: unknown;
};

// Grava um evento dentro da transação do withTenant. O banco calcula hash, hash anterior e data.
export async function registrarAuditoria(
  tx: ClienteTransacao,
  evento: EventoAuditoria,
): Promise<void> {
  await tx.auditoriaEvento.create({
    data: {
      instituicao_id: evento.instituicaoId,
      ator: evento.ator,
      acao: evento.acao,
      alvo: evento.alvo ?? '',
      antes: mascarar(evento.antes),
      depois: mascarar(evento.depois),
    },
  });
}

// Devolve os eventos da cadeia da instituição do contexto que não conferem (lista vazia = íntegra)
export async function verificarCadeia(
  tx: ClienteTransacao,
): Promise<{ evento_id: bigint; problema: string }[]> {
  return tx.$queryRaw`SELECT evento_id, problema FROM auditoria_verificar()`;
}
