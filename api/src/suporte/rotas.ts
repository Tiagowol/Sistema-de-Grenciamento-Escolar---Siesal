import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registrarAuditoria } from '../auditoria/auditoria.js';
import type { SessaoAtiva } from '../auth/autenticacao.js';
import type { EnviarEmail } from '../auth/email.js';
import {
  comDesfazer,
  decidirPedido,
  erroDaDecisao,
  listarPedidos,
} from '../auth/pedido-convite.js';
import { podeSerAtendenteDeSuporte } from '../auth/politica.js';
import {
  type ClienteTransacao,
  type withTenant as WithTenant,
  withTenant,
} from '../banco/withTenant.js';

// L22f: o Admin INDICADO pelo Master atende os pedidos de suporte dos espaços individuais.
// Só passa por funções do banco, que conferem a indicação a cada chamada (indicado, Admin ativo, escola ativa) e só
// devolvem os campos da fila: assunto, texto, nome e e-mail de quem pediu, e o dia. Nunca outro dado do espaço.
type Banco = Parameters<typeof WithTenant>[0];
type Exigir = (req: FastifyRequest, res: FastifyReply) => Promise<SessaoAtiva | null>;
type Opcoes = {
  banco: Banco;
  exigirSessao: Exigir;
  enviarEmail?: EnviarEmail;
  linkBase?: string;
};

type Pedido = {
  pedido_id: string;
  espaco_id: string;
  assunto: string;
  texto: string;
  nome: string;
  email: string;
  criado_em: Date;
};

const ROTULO_ASSUNTO: Record<string, string> = {
  acesso: 'Não consigo entrar',
  nao_consigo_usar: 'Não consigo usar uma tela',
  duvida_nota: 'Dúvida sobre uma nota',
  erro_na_tela: 'Apareceu um erro',
  outro: 'Outro assunto',
};
const diaDe = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);

// L22k: funções que o Master pode dar a um Admin (lista fechada; a migração 0036 tem a mesma lista)
export const FUNCOES_INDICADAS = ['suporte_individual', 'pedido_convite'] as const;
export type FuncaoIndicada = (typeof FUNCOES_INDICADAS)[number];

// A indicação PARA ESTA FUNÇÃO vale agora? (função do banco; não confia em nada que veio da tela)
export async function ehAtendenteAtivo(
  tx: ClienteTransacao,
  sessao: SessaoAtiva,
  funcao: FuncaoIndicada,
): Promise<boolean> {
  if (sessao.nivel !== 'completo' || !podeSerAtendenteDeSuporte(sessao.perfil)) return false;
  const [r] = await tx.$queryRaw<{ ok: boolean }[]>`
    SELECT admin_funcao_ativa(${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, ${funcao}) AS ok`;
  return r?.ok === true;
}

// L22k: funções vigentes do Admin (para o site mostrar só o menu e o sino de cada uma)
export async function funcoesIndicadas(
  tx: ClienteTransacao,
  sessao: SessaoAtiva,
): Promise<FuncaoIndicada[]> {
  const lista: FuncaoIndicada[] = [];
  for (const f of FUNCOES_INDICADAS) if (await ehAtendenteAtivo(tx, sessao, f)) lista.push(f);
  return lista;
}

// Item do sino Mensagens do Admin indicado: só a quantidade, em palavra e número, sem pressão
export async function itensDeSuporteIndividual(tx: ClienteTransacao, sessao: SessaoAtiva) {
  if (!(await ehAtendenteAtivo(tx, sessao, 'suporte_individual'))) return [];
  const [r] = await tx.$queryRaw<{ n: number }[]>`
    SELECT suporte_ind_contar_admin(${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid) AS n`;
  const n = Number(r?.n ?? 0);
  if (n === 0) return [];
  return [
    {
      tipo: 'suporte_individual',
      id: 'suporte_individual',
      visto: false,
      dia: diaDe(new Date()),
      abertos: n,
    },
  ];
}

// L22j (item 2): item próprio do sino para pedidos de convite, separado do suporte (rótulo e contagem próprios)
export async function itensDePedidoConvite(tx: ClienteTransacao, sessao: SessaoAtiva) {
  if (!(await ehAtendenteAtivo(tx, sessao, 'pedido_convite'))) return [];
  const [r] = await tx.$queryRaw<{ n: number }[]>`
    SELECT pedido_convite_contar_admin(${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid) AS n`;
  const n = Number(r?.n ?? 0);
  if (n === 0) return [];
  return [
    {
      tipo: 'pedido_convite',
      id: 'pedido_convite',
      visto: false,
      dia: diaDe(new Date()),
      abertos: n,
    },
  ];
}

export function registrarSuporteIndividual(app: FastifyInstance, opcoes: Opcoes): void {
  const tenant = (s: SessaoAtiva) => ({ instituicaoId: s.instituicaoId });
  const auditar = (tx: ClienteTransacao, s: SessaoAtiva, acao: string, alvo = '') =>
    registrarAuditoria(tx, {
      instituicaoId: s.instituicaoId,
      ator: `usuario:${s.usuarioId}`,
      acao,
      alvo,
    });

  // O site só mostra o menu se for atendente; aqui também se confere
  app.get('/suporte-individual', async (req, res) => {
    const sessao = await opcoes.exigirSessao(req, res);
    if (!sessao) return res;
    const r = await withTenant(opcoes.banco, tenant(sessao), async (tx) => {
      if (!(await ehAtendenteAtivo(tx, sessao, 'suporte_individual'))) {
        // Só o Admin que tentou sem ser indicado deixa rastro (os outros perfis nunca teriam esta tela)
        if (sessao.nivel === 'completo' && podeSerAtendenteDeSuporte(sessao.perfil))
          await auditar(tx, sessao, 'suporte_individual.acesso_negado', 'GET /suporte-individual');
        return null;
      }
      const fila = await tx.$queryRaw<Pedido[]>`
        SELECT * FROM suporte_ind_listar_admin(${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid)`;
      await auditar(tx, sessao, 'suporte_individual.fila_aberta', 'suporte_individual');
      return fila;
    });
    if (r === null) return res.code(403).send({ erro: 'Sem permissão.' });
    return {
      pedidos: r
        .sort((a, b) => a.criado_em.getTime() - b.criado_em.getTime())
        .map((p) => ({ ...p, assunto_rotulo: ROTULO_ASSUNTO[p.assunto] ?? 'Outro assunto' })),
    };
  });

  app.post('/suporte-individual/:id/atender', async (req, res) => {
    const sessao = await opcoes.exigirSessao(req, res);
    if (!sessao) return res;
    const params = z.strictObject({ id: z.uuid() }).safeParse(req.params);
    const corpo = z.strictObject({ espaco_id: z.uuid() }).safeParse(req.body);
    if (!params.success || !corpo.success) return res.code(400).send({ erro: 'Dados inválidos.' });
    const r = await withTenant(opcoes.banco, tenant(sessao), async (tx) => {
      if (!(await ehAtendenteAtivo(tx, sessao, 'suporte_individual'))) return 'proibido';
      const [x] = await tx.$queryRaw<{ r: string }[]>`
        SELECT suporte_ind_atender_admin(${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid,
                                         ${corpo.data.espaco_id}::uuid, ${params.data.id}::uuid) AS r`;
      if (x?.r === 'ok')
        await auditar(
          tx,
          sessao,
          'suporte_individual.atendido',
          `pedido_suporte:${params.data.id}`,
        );
      return x?.r ?? 'nao_encontrado';
    });
    if (r === 'proibido') return res.code(403).send({ erro: 'Sem permissão.' });
    if (r !== 'ok') return res.code(404).send({ erro: 'Pedido não encontrado.' });
    return res.code(204).send();
  });
  // L22i (item 3): pedidos de convite de quem não tem código. O Admin indicado vê nome, e-mail e motivo e decide.
  app.get('/pedidos-convite', async (req, res) => {
    const sessao = await opcoes.exigirSessao(req, res);
    if (!sessao) return res;
    const r = await withTenant(opcoes.banco, tenant(sessao), async (tx) => {
      if (!(await ehAtendenteAtivo(tx, sessao, 'pedido_convite'))) return null;
      const fila = await listarPedidos(tx, {
        tipo: 'admin',
        inst: sessao.instituicaoId,
        usuario: sessao.usuarioId,
      });
      await auditar(tx, sessao, 'pedido_convite.fila_aberta', 'pedido_convite');
      return fila;
    });
    if (r === null) return res.code(403).send({ erro: 'Sem permissão.' });
    return { pedidos: r };
  });
  for (const acao of ['aprovar', 'recusar'] as const) {
    app.post(`/pedidos-convite/:id/${acao}`, async (req, res) => {
      const sessao = await opcoes.exigirSessao(req, res);
      if (!sessao) return res;
      const params = z.strictObject({ id: z.uuid() }).safeParse(req.params);
      if (!params.success) return res.code(400).send({ erro: 'Dados inválidos.' });
      const r = await comDesfazer(() =>
        withTenant(opcoes.banco, tenant(sessao), async (tx) => {
          if (!(await ehAtendenteAtivo(tx, sessao, 'pedido_convite')))
            return { resultado: 'proibido' as const };
          const x = await decidirPedido(
            tx,
            { tipo: 'admin', inst: sessao.instituicaoId, usuario: sessao.usuarioId },
            acao,
            params.data.id,
            { enviarEmail: opcoes.enviarEmail, linkBase: opcoes.linkBase },
          );
          if (x.resultado === 'ok')
            await auditar(
              tx,
              sessao,
              acao === 'aprovar' ? 'pedido_convite.aprovado' : 'pedido_convite.recusado',
              `pedido_convite:${params.data.id}`,
            );
          return x;
        }),
      );
      const erro = erroDaDecisao(r.resultado);
      if (erro) return res.code(erro.status).send({ erro: erro.erro });
      // L22j: aprovar devolve o código para a tela (nunca vai para a auditoria)
      return r.convite ? r.convite : res.code(204).send();
    });
  }
}
