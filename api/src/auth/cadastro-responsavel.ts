import { createHash, randomBytes } from 'node:crypto';
import { registrarAuditoria } from '../auditoria/auditoria.js';
import { type ClienteTransacao, withTenant } from '../banco/withTenant.js';
import type { PrismaClient } from '../gerado/prisma/client.js';
import { hashDoCodigo } from './convite-individual.js';
import { type ChavesCpf, dataValida, idadeEm, protegerCpf, validarCpf } from './cpf.js';
import { hashSenha, validarSenha } from './senha.js';
import { TERMO_VERSAO, textosDoTermo } from './termo.js';

// Cadastro do aluno com data de nascimento e CPF (20c-2). Menor de 18 anos fica "aguardando o responsável" e só entra
// depois que o responsável confirma o link (uso único, 7 dias). Só dados fictícios na Parte 1.
type Banco = Pick<PrismaClient, '$queryRaw' | '$transaction'>;

export type DadosResponsavel = { nome: string; cpf: string; nascimento: string; email: string };
export type EntradaCadastro = {
  codigo: string;
  nome: string;
  email: string;
  senha: string;
  nascimento: string;
  cpf?: string | undefined;
  matricula?: string | undefined;
  escolas?: string | undefined;
  responsavel?: DadosResponsavel | undefined;
};
export type ResultadoCadastro =
  | { tipo: 'ok'; instituicaoId: string; usuarioId: string }
  | { tipo: 'aguardando'; instituicaoId: string; usuarioId: string; token: string }
  | { tipo: 'senha_fraca'; motivo: string }
  | { tipo: 'dados'; motivo: string }
  | { tipo: 'sem_chave' }
  | { tipo: 'recusada' };

export const gerarToken = (): string => randomBytes(32).toString('base64url');
export const hashToken = (t: string): string => createHash('sha256').update(t).digest('hex');
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Apaga os pedidos vencidos (pedido e dados do aluno; a conta fica inativa). Chamada antes de cada uso e pelo servidor.
export async function limparPedidosVencidos(
  banco: Pick<PrismaClient, '$queryRaw'>,
): Promise<number> {
  const [r] = await banco.$queryRaw<{ n: number }[]>`SELECT pedido_responsavel_limpar() AS n`;
  return r?.n ?? 0;
}

export async function criarCadastroAluno(
  banco: Banco,
  chaves: ChavesCpf | undefined,
  e: EntradaCadastro,
  hoje: Date,
): Promise<ResultadoCadastro> {
  const motivo = validarSenha(e.senha);
  if (motivo) return { tipo: 'senha_fraca', motivo };
  if (!dataValida(e.nascimento, hoje))
    return { tipo: 'dados', motivo: 'Confira a data de nascimento.' };
  const menor = idadeEm(e.nascimento, hoje) < 18;
  if (menor && !e.responsavel)
    return { tipo: 'dados', motivo: 'Quem tem menos de 18 anos precisa informar o responsável.' };
  if (!menor && e.responsavel)
    return { tipo: 'dados', motivo: 'Responsável só é pedido para quem tem menos de 18 anos.' };

  const cpfAluno = e.cpf?.trim() ? validarCpf(e.cpf) : null;
  if (e.cpf?.trim() && !cpfAluno) return { tipo: 'dados', motivo: 'Confira o CPF.' };
  let cpfResp: string | null = null;
  if (e.responsavel) {
    const r = e.responsavel;
    cpfResp = validarCpf(r.cpf);
    if (!cpfResp) return { tipo: 'dados', motivo: 'Confira o CPF do responsável.' };
    if (!dataValida(r.nascimento, hoje) || idadeEm(r.nascimento, hoje) < 18)
      return { tipo: 'dados', motivo: 'O responsável precisa ter 18 anos ou mais.' };
    if (cpfAluno && cpfAluno === cpfResp)
      return { tipo: 'dados', motivo: 'O CPF do responsável deve ser diferente do seu.' };
    if (!EMAIL.test(r.email.trim()))
      return { tipo: 'dados', motivo: 'Confira o e-mail do responsável.' };
    if (r.email.trim().toLowerCase() === e.email.trim().toLowerCase())
      return { tipo: 'dados', motivo: 'O e-mail do responsável deve ser diferente do seu.' };
  }
  if ((cpfAluno || cpfResp) && !chaves) return { tipo: 'sem_chave' };

  await limparPedidosVencidos(banco).catch(() => 0);
  const token = e.responsavel ? gerarToken() : '';
  const aluno = {
    ...(cpfAluno && chaves ? protegerCpf(cpfAluno, chaves) : {}),
    matricula: e.matricula ?? null,
    escolas: e.escolas ?? null,
  };
  const pedido =
    e.responsavel && cpfResp && chaves
      ? {
          nome: e.responsavel.nome,
          email: e.responsavel.email,
          nascimento: e.responsavel.nascimento,
          ...protegerCpf(cpfResp, chaves),
        }
      : null;
  const senhaHash = await hashSenha(e.senha);
  let instituicaoId: string;
  try {
    const [r] = await banco.$queryRaw<{ id: string }[]>`
      SELECT cadastro_aluno_criar(${hashDoCodigo(e.codigo)}, ${e.nome.trim()}, ${e.email.trim()}, ${senhaHash},
        ${e.nascimento}::date, ${JSON.stringify(aluno)}::jsonb,
        ${pedido ? JSON.stringify(pedido) : null}::jsonb, ${token ? hashToken(token) : null}) AS id`;
    if (!r?.id) return { tipo: 'recusada' };
    instituicaoId = r.id;
  } catch {
    return { tipo: 'recusada' };
  }
  // Auditoria sem nenhum valor de CPF: só se havia CPF e se era menor
  const usuarioId = await withTenant(banco as PrismaClient, { instituicaoId }, async (tx) => {
    const [u] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM usuario LIMIT 1`;
    const id = (u as { id: string }).id;
    await registrarAuditoria(tx as ClienteTransacao, {
      instituicaoId,
      ator: `usuario:${id}`,
      acao: menor ? 'conta.criada_aguardando_responsavel' : 'conta.criada_por_convite',
      alvo: `usuario:${id}`,
      depois: { cpf_informado: Boolean(cpfAluno), menor_de_18: menor },
    });
    return id;
  });
  return menor
    ? { tipo: 'aguardando', instituicaoId, usuarioId, token }
    : { tipo: 'ok', instituicaoId, usuarioId };
}

export type PedidoVisto = {
  aluno: string;
  responsavel: string;
  expiraEm: string;
  termo: { versao: string; caixas: string[] };
};

// O que o responsável vê antes de decidir. Link inválido, vencido ou já usado dá null (a API responde igual).
export async function consultarPedido(
  banco: Pick<PrismaClient, '$queryRaw'>,
  token: string,
): Promise<PedidoVisto | null> {
  await limparPedidosVencidos(banco).catch(() => 0);
  const [r] = await banco.$queryRaw<{ aluno_nome: string; resp_nome: string; expira_em: Date }[]>`
    SELECT * FROM pedido_responsavel_consultar(${hashToken(token)})`;
  if (!r) return null;
  return {
    aluno: r.aluno_nome,
    responsavel: r.resp_nome,
    expiraEm: r.expira_em.toISOString(),
    termo: { versao: TERMO_VERSAO, caixas: textosDoTermo(r.aluno_nome) },
  };
}

// Confirma com as 3 caixas marcadas. Guarda versão do termo e hora; libera a conta do aluno. Uso único.
export async function confirmarPedido(
  banco: Pick<PrismaClient, '$queryRaw' | '$transaction'>,
  token: string,
  aceites: boolean[],
): Promise<'ok' | 'recusada'> {
  if (aceites.length !== 3 || !aceites.every(Boolean)) return 'recusada';
  await limparPedidosVencidos(banco).catch(() => 0);
  let c: { instituicao_id: string; usuario_id: string } | undefined;
  try {
    [c] = await banco.$queryRaw<{ instituicao_id: string; usuario_id: string }[]>`
      SELECT * FROM pedido_responsavel_confirmar(${hashToken(token)}, ${TERMO_VERSAO})`;
  } catch {
    return 'recusada';
  }
  if (!c) return 'recusada';
  const { instituicao_id: instituicaoId, usuario_id: usuarioId } = c;
  await withTenant(banco as PrismaClient, { instituicaoId }, (tx) =>
    registrarAuditoria(tx as ClienteTransacao, {
      instituicaoId,
      ator: 'responsavel',
      acao: 'responsavel.autorizou',
      alvo: `usuario:${usuarioId}`,
      depois: { termo_versao: TERMO_VERSAO },
    }),
  );
  return 'ok';
}
