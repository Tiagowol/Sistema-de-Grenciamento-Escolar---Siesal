import type { ClienteTransacao } from '../banco/withTenant.js';
import type { PrismaClient } from '../gerado/prisma/client.js';
import { gerarCodigoDeConvite, hashDoCodigo } from './convite-individual.js';
import type { EnviarEmail } from './email.js';

// L22i (item 2): quem não tem código de convite pede um. O pedido fica pendente; nenhuma conta nem convite é criado aqui.
export type EntradaPedidoConvite = { nome: string; email: string; motivo: string };

// Devolve se um pedido novo foi gravado. A rota responde igual nos dois casos (e-mail com espaço ou com pedido pendente),
// para não revelar quem já tem conta; o resultado serve só ao registro do servidor.
export async function solicitarConvite(
  banco: Pick<PrismaClient, '$queryRaw'>,
  e: EntradaPedidoConvite,
): Promise<boolean> {
  const [r] = await banco.$queryRaw<{ ok: boolean }[]>`
    SELECT pedido_convite_criar(${e.nome.trim()}, ${e.email.trim()}, ${e.motivo.trim()}) AS ok`;
  return r?.ok === true;
}

// ---------- Item 3: fila e decisão (Master e Admin indicado) ----------
export type PedidoPendente = {
  pedido_id: string;
  nome: string;
  email: string;
  motivo: string;
  criado_em: Date;
};
// Quem decide: o Master (papel siesal_ops) ou o Admin indicado (papel siesal_app; o banco confere a indicação a cada chamada)
export type Decisor =
  | { tipo: 'master'; usuario: string }
  | { tipo: 'admin'; inst: string; usuario: string };
export type ResultadoDecisao = 'ok' | 'nao_encontrado' | 'proibido' | 'sem_email' | 'email_falhou';
export type EntregaEmail = { enviarEmail?: EnviarEmail; linkBase?: string };
// L22j (item 1): ao aprovar, o código volta também para a tela de quem decidiu (o e-mail só chega na caixa de teste local)
export type ConviteCriado = { codigo: string; expira_em: Date };
export type Decisao = { resultado: ResultadoDecisao; convite?: ConviteCriado };

// Lançada dentro da transação para desfazer a decisão quando o e-mail não sai (o pedido continua pendente)
export class DesfazerDecisao extends Error {
  constructor(public resultado: ResultadoDecisao) {
    super(resultado);
  }
}
export async function comDesfazer(f: () => Promise<Decisao>): Promise<Decisao> {
  try {
    return await f();
  } catch (x) {
    if (x instanceof DesfazerDecisao) return { resultado: x.resultado };
    throw x;
  }
}

export async function listarPedidos(tx: ClienteTransacao, d: Decisor): Promise<PedidoPendente[]> {
  return d.tipo === 'master'
    ? tx.$queryRaw<PedidoPendente[]>`SELECT * FROM pedido_convite_listar()`
    : tx.$queryRaw<PedidoPendente[]>`
        SELECT * FROM pedido_convite_listar_admin(${d.inst}::uuid, ${d.usuario}::uuid)`;
}

const dataBr = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(d);

// Aprovar cria o convite e envia o código; recusar só avisa, sem dizer o motivo. Se o e-mail falhar, lança DesfazerDecisao.
export async function decidirPedido(
  tx: ClienteTransacao,
  d: Decisor,
  acao: 'aprovar' | 'recusar',
  pedidoId: string,
  e: EntregaEmail,
): Promise<Decisao> {
  if (!e.enviarEmail) throw new DesfazerDecisao('sem_email');
  const por = `${d.tipo}:${d.usuario}`;
  if (acao === 'recusar') {
    const [r] =
      d.tipo === 'master'
        ? await tx.$queryRaw<{ resultado: string; nome: string; email: string }[]>`
            SELECT * FROM pedido_convite_recusar(${pedidoId}::uuid, ${por})`
        : await tx.$queryRaw<{ resultado: string; nome: string; email: string }[]>`
            SELECT * FROM pedido_convite_recusar_admin(${d.inst}::uuid, ${d.usuario}::uuid, ${pedidoId}::uuid)`;
    if (r?.resultado !== 'ok')
      return { resultado: (r?.resultado as ResultadoDecisao) ?? 'nao_encontrado' };
    try {
      await e.enviarEmail({
        para: r.email,
        assunto: 'SIESAL: sobre o seu pedido de convite',
        texto: `Olá, ${r.nome}.\n\nNão foi possível aprovar o seu pedido de convite desta vez. Não informamos o motivo por e-mail.\n\nSe quiser, você pode fazer um novo pedido na tela de entrada do SIESAL.\n`,
      });
    } catch {
      throw new DesfazerDecisao('email_falhou');
    }
    return { resultado: 'ok' };
  }
  const codigo = gerarCodigoDeConvite();
  const hash = hashDoCodigo(codigo);
  type Linha = { resultado: string; nome: string; email: string; expira_em: Date };
  const [r] =
    d.tipo === 'master'
      ? await tx.$queryRaw<Linha[]>`
          SELECT * FROM pedido_convite_aprovar(${pedidoId}::uuid, ${hash}, ${por})`
      : await tx.$queryRaw<Linha[]>`
          SELECT * FROM pedido_convite_aprovar_admin(${d.inst}::uuid, ${d.usuario}::uuid, ${pedidoId}::uuid, ${hash})`;
  if (r?.resultado !== 'ok')
    return { resultado: (r?.resultado as ResultadoDecisao) ?? 'nao_encontrado' };
  const link = `${(e.linkBase ?? 'http://localhost:18080').replace(/\/+$/, '')}/cadastro/aluno#${codigo}`;
  try {
    await e.enviarEmail({
      para: r.email,
      assunto: 'SIESAL: seu convite',
      texto: `Olá, ${r.nome}.\n\nSeu pedido foi aprovado. Para criar a sua conta, use este código de convite:\n${codigo}\n\nOu abra este link, que já traz o código:\n${link}\n\nO convite vale por 7 dias (até ${dataBr(r.expira_em)}) e serve para uma conta só.\n\nSe você não fez este pedido, ignore esta mensagem.\n`,
    });
  } catch {
    throw new DesfazerDecisao('email_falhou');
  }
  return { resultado: 'ok', convite: { codigo, expira_em: r.expira_em } };
}

// Resposta HTTP de cada resultado que não é 'ok' (mensagens iguais para o Master e para o Admin indicado)
export function erroDaDecisao(r: ResultadoDecisao): { status: number; erro: string } | null {
  if (r === 'ok') return null;
  if (r === 'proibido') return { status: 403, erro: 'Sem permissão.' };
  if (r === 'nao_encontrado') return { status: 404, erro: 'Pedido não encontrado ou já decidido.' };
  if (r === 'sem_email')
    return { status: 503, erro: 'O envio de e-mail não está disponível agora. Nada foi alterado.' };
  return {
    status: 502,
    erro: 'Não foi possível enviar o e-mail. Nada foi alterado. Tente de novo.',
  };
}
