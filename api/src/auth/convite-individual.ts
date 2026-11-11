import { createHash, randomBytes } from 'node:crypto';
import { registrarAuditoria } from '../auditoria/auditoria.js';
import { type ClienteTransacao, withTenant } from '../banco/withTenant.js';
import type { PrismaClient } from '../gerado/prisma/client.js';
import { hashSenha, validarSenha } from './senha.js';

// Convite de uso único para criar um espaço individual (20c-1, D4). O código é mostrado uma vez ao Master e
// guardado só como hash; vale 7 dias. Alfabeto sem letras e números que se confundem (0, 1, I, O).
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TAMANHO = 16;

export function gerarCodigoDeConvite(): string {
  const bytes = randomBytes(TAMANHO);
  let texto = '';
  for (const b of bytes) texto += ALFABETO[b % ALFABETO.length];
  return (texto.match(/.{4}/g) as string[]).join('-');
}
// O que a pessoa digita pode vir com minúsculas, espaços ou sem os traços
export const normalizarCodigo = (c: string): string => c.toUpperCase().replace(/[^A-Z2-9]/g, '');
export const hashDoCodigo = (c: string): string =>
  createHash('sha256').update(normalizarCodigo(c)).digest('hex');

export type EntradaConta = { codigo: string; nome: string; email: string; senha: string };
export type ResultadoConta =
  | { tipo: 'ok'; instituicaoId: string; usuarioId: string }
  | { tipo: 'senha_fraca'; motivo: string }
  | { tipo: 'recusada' };

// Cria o espaço individual, o aluno e a senha, numa transação do banco. Convite inválido, vencido, já usado ou
// e-mail já em uso dão a mesma resposta (sem dizer qual), e o convite só é gasto se tudo der certo.
export async function criarContaIndividual(
  banco: Pick<PrismaClient, '$queryRaw' | '$transaction'>,
  e: EntradaConta,
): Promise<ResultadoConta> {
  const motivo = validarSenha(e.senha);
  if (motivo) return { tipo: 'senha_fraca', motivo };
  const senhaHash = await hashSenha(e.senha);
  let instituicaoId: string;
  try {
    const [r] = await banco.$queryRaw<{ id: string }[]>`
      SELECT espaco_individual_criar(${hashDoCodigo(e.codigo)}, ${e.nome.trim()}, ${e.email.trim()}, ${senhaHash}) AS id`;
    if (!r?.id) return { tipo: 'recusada' };
    instituicaoId = r.id;
  } catch {
    return { tipo: 'recusada' };
  }
  const usuarioId = await withTenant(banco as PrismaClient, { instituicaoId }, async (tx) => {
    const [u] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM usuario LIMIT 1`;
    const id = (u as { id: string }).id;
    await registrarAuditoria(tx as ClienteTransacao, {
      instituicaoId,
      ator: `usuario:${id}`,
      acao: 'conta.criada_por_convite',
      alvo: `usuario:${id}`,
    });
    return id;
  });
  return { tipo: 'ok', instituicaoId, usuarioId };
}

export type EntradaInstituicao = {
  codigo: string;
  instituicao: string;
  nome: string;
  email: string;
  senha: string;
};
export type ResultadoInstituicao =
  | { tipo: 'ok'; instituicaoId: string; usuarioId: string }
  | { tipo: 'senha_fraca'; motivo: string }
  | { tipo: 'recusada' };

// Convite de instituição (20c-3): cria a instituição "em implantação" e o Admin com a senha escolhida, numa transação.
// O segundo fator (TOTP) continua obrigatório no primeiro login. Convite inválido, vencido ou usado dá a mesma resposta.
export async function criarInstituicaoPorConvite(
  banco: Pick<PrismaClient, '$queryRaw' | '$transaction'>,
  e: EntradaInstituicao,
): Promise<ResultadoInstituicao> {
  const motivo = validarSenha(e.senha);
  if (motivo) return { tipo: 'senha_fraca', motivo };
  const senhaHash = await hashSenha(e.senha);
  let instituicaoId: string;
  try {
    const [r] = await banco.$queryRaw<{ id: string }[]>`
      SELECT instituicao_criar_por_convite(${hashDoCodigo(e.codigo)}, ${e.instituicao.trim()}, ${e.nome.trim()}, ${e.email.trim()}, ${senhaHash}) AS id`;
    if (!r?.id) return { tipo: 'recusada' };
    instituicaoId = r.id;
  } catch {
    return { tipo: 'recusada' };
  }
  const usuarioId = await withTenant(banco as PrismaClient, { instituicaoId }, async (tx) => {
    const [u] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM usuario LIMIT 1`;
    const id = (u as { id: string }).id;
    await registrarAuditoria(tx as ClienteTransacao, {
      instituicaoId,
      ator: `usuario:${id}`,
      acao: 'instituicao.criada_por_convite',
      alvo: `instituicao:${instituicaoId}`,
    });
    return id;
  });
  return { tipo: 'ok', instituicaoId, usuarioId };
}
