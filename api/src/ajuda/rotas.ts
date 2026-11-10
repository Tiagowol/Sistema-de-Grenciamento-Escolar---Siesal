import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registrarAuditoria } from '../auditoria/auditoria.js';
import type { SessaoAtiva } from '../auth/autenticacao.js';
import { podeAtenderAjuda, podePedirAjuda } from '../auth/politica.js';
import {
  type ClienteTransacao,
  type withTenant as WithTenant,
  withTenant,
} from '../banco/withTenant.js';

// Pedido de ajuda (L17): o aluno pede ajuda ao professor de uma turma dele ou à equipe pedagógica (NAPNE).
// O professor só vê o que foi pedido a ele, nas turmas e disciplinas em que tem vínculo ativo.
// O Pedagógico vê os pedidos feitos à equipe pedagógica da instituição. Sem ranking, sem comparação.
type Banco = Parameters<typeof WithTenant>[0];
type Exigir = (req: FastifyRequest, res: FastifyReply) => Promise<SessaoAtiva | null>;
type Opcoes = { banco: Banco; exigirSessao: Exigir };
type Linha = Record<string, unknown>;

export const MOTIVOS_AJUDA = ['nao_entendi', 'nao_sei_comecar', 'preciso_tempo', 'outro'] as const;
// Limite de pedidos esperando resposta ao mesmo tempo, por aluno (evita envio repetido sem querer)
export const MAXIMO_ABERTOS = 5;

const uuid = z.uuid();
const idParam = z.strictObject({ id: uuid });
const semLink = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((t) => !/(https?:|www\.|:\/\/)/i.test(t), 'Não use links.');
const corpoPedido = z.discriminatedUnion('destino', [
  z.strictObject({
    destino: z.literal('professor'),
    professor_id: uuid,
    turma_id: uuid,
    disciplina_id: uuid,
    tarefa_id: uuid.optional(),
    microetapa_id: uuid.optional(),
    motivo: z.enum(MOTIVOS_AJUDA),
    texto: semLink(300).optional(),
  }),
  z.strictObject({
    destino: z.literal('pedagogico'),
    tarefa_id: uuid.optional(),
    microetapa_id: uuid.optional(),
    motivo: z.enum(MOTIVOS_AJUDA),
    texto: semLink(300).optional(),
  }),
]);
const corpoAtender = z.strictObject({ resposta: semLink(300).optional() });

export function registrarAjuda(app: FastifyInstance, opcoes: Opcoes): void {
  const auditar = (
    tx: ClienteTransacao,
    sessao: SessaoAtiva,
    acao: string,
    alvo: string,
    depois?: unknown,
  ) =>
    registrarAuditoria(tx, {
      instituicaoId: sessao.instituicaoId,
      ator: `usuario:${sessao.usuarioId}`,
      acao,
      alvo,
      depois,
    });

  // Deny by default: perfil sem permissão (ou sessão incompleta) é negado e a tentativa é auditada
  function rota<P extends z.ZodType = z.ZodUndefined, B extends z.ZodType = z.ZodUndefined>(
    metodo: 'get' | 'post',
    caminho: string,
    permite: (perfil: string) => boolean,
    esquemas: { params?: P; corpo?: B },
    funcao: (c: {
      tx: ClienteTransacao;
      sessao: SessaoAtiva;
      params: z.infer<P>;
      corpo: z.infer<B>;
      resposta: FastifyReply;
    }) => Promise<unknown>,
  ): void {
    app[metodo](caminho, async (req, res) => {
      const sessao = await opcoes.exigirSessao(req, res);
      if (!sessao) return res;
      if (sessao.nivel !== 'completo' || !permite(sessao.perfil)) {
        await withTenant(opcoes.banco, { instituicaoId: sessao.instituicaoId }, (tx) =>
          auditar(tx, sessao, 'ajuda.acesso_negado', `${metodo.toUpperCase()} ${caminho}`, {
            perfil: sessao.perfil,
          }),
        );
        return res.code(403).send({ erro: 'Sem permissão.' });
      }
      const params = esquemas.params ? esquemas.params.safeParse(req.params) : null;
      const corpo = esquemas.corpo ? esquemas.corpo.safeParse(req.body ?? {}) : null;
      if ((params && !params.success) || (corpo && !corpo.success)) {
        const links =
          corpo && !corpo.success && corpo.error.issues.some((i) => i.message === 'Não use links.');
        return res
          .code(400)
          .send({ erro: links ? 'O texto não pode ter links.' : 'Dados inválidos.' });
      }
      const saida = await withTenant(opcoes.banco, { instituicaoId: sessao.instituicaoId }, (tx) =>
        funcao({
          tx,
          sessao,
          params: (params?.data ?? undefined) as never,
          corpo: (corpo?.data ?? undefined) as never,
          resposta: res,
        }),
      );
      if (res.sent) return res;
      return saida === undefined ? res.code(204).send() : saida;
    });
  }

  // Para quem o aluno pode pedir ajuda: os professores das turmas dele (com a disciplina) e a equipe pedagógica
  rota('get', '/ajuda/destinos', podePedirAjuda, {}, async ({ tx, sessao }) => {
    const professores = await tx.$queryRaw<Linha[]>`
      SELECT DISTINCT p.id AS professor_id, p.nome AS professor_nome, t.id AS turma_id, t.nome AS turma_nome,
             d.id AS disciplina_id, d.nome AS disciplina_nome
        FROM vinculo av
        JOIN vinculo pv ON pv.tipo = 'professor_turma' AND pv.turma_id = av.turma_id AND pv.desativado_em IS NULL
        JOIN usuario p ON p.id = pv.usuario_id AND p.perfil = 'professor' AND p.desativado_em IS NULL
        JOIN turma t ON t.id = av.turma_id AND t.desativado_em IS NULL
        JOIN disciplina d ON d.id = pv.disciplina_id AND d.desativado_em IS NULL
       WHERE av.tipo = 'aluno_turma' AND av.usuario_id = ${sessao.usuarioId}::uuid AND av.desativado_em IS NULL
       ORDER BY d.nome, p.nome`;
    const [ped] = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM usuario WHERE perfil = 'pedagogico' AND desativado_em IS NULL`;
    return { professores, equipe_pedagogica: (ped?.n ?? 0) > 0 };
  });

  // O aluno pede ajuda. Professor: precisa ser de uma turma ativa do aluno, na disciplina escolhida.
  rota('post', '/ajuda', podePedirAjuda, { corpo: corpoPedido }, async (c) => {
    const { tx, sessao, corpo, resposta } = c;
    const eu = sessao.usuarioId;
    if (corpo.destino === 'professor') {
      const [ok] = await tx.$queryRaw<Linha[]>`
        SELECT 1 FROM vinculo av
          JOIN vinculo pv ON pv.tipo = 'professor_turma' AND pv.turma_id = av.turma_id AND pv.desativado_em IS NULL
         WHERE av.tipo = 'aluno_turma' AND av.usuario_id = ${eu}::uuid AND av.desativado_em IS NULL
           AND av.turma_id = ${corpo.turma_id}::uuid AND pv.usuario_id = ${corpo.professor_id}::uuid
           AND pv.disciplina_id = ${corpo.disciplina_id}::uuid`;
      if (!ok) return resposta.code(404).send({ erro: 'Não encontrado.' });
    } else {
      const [ped] = await tx.$queryRaw<Linha[]>`
        SELECT 1 FROM usuario WHERE perfil = 'pedagogico' AND desativado_em IS NULL LIMIT 1`;
      if (!ped)
        return resposta
          .code(409)
          .send({ erro: 'A escola ainda não tem equipe pedagógica no sistema.' });
    }
    // A atividade e a etapa, se vierem, têm de ser do próprio aluno (e a etapa, da atividade)
    if (corpo.tarefa_id) {
      const [t] = await tx.$queryRaw<Linha[]>`
        SELECT 1 FROM tarefa WHERE id = ${corpo.tarefa_id}::uuid AND usuario_id = ${eu}::uuid AND desativado_em IS NULL`;
      if (!t) return resposta.code(404).send({ erro: 'Não encontrado.' });
    }
    if (corpo.microetapa_id) {
      const [m] = await tx.$queryRaw<Linha[]>`
        SELECT 1 FROM microetapa WHERE id = ${corpo.microetapa_id}::uuid AND usuario_id = ${eu}::uuid
           AND tarefa_id = ${corpo.tarefa_id ?? null}::uuid AND desativado_em IS NULL`;
      if (!m) return resposta.code(404).send({ erro: 'Não encontrado.' });
    }
    const [abertos] = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pedido_ajuda WHERE aluno_id = ${eu}::uuid AND estado = 'aberto'`;
    if ((abertos?.n ?? 0) >= MAXIMO_ABERTOS) {
      return resposta.code(409).send({
        erro: `Você já tem ${MAXIMO_ABERTOS} pedidos esperando resposta. A resposta aparece no sino Mensagens.`,
      });
    }
    const prof = corpo.destino === 'professor' ? corpo : null;
    const [novo] = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO pedido_ajuda (instituicao_id, aluno_id, destino, professor_id, turma_id, disciplina_id,
                                tarefa_id, microetapa_id, motivo, texto)
      VALUES (${sessao.instituicaoId}::uuid, ${eu}::uuid, ${corpo.destino}, ${prof?.professor_id ?? null}::uuid,
              ${prof?.turma_id ?? null}::uuid, ${prof?.disciplina_id ?? null}::uuid,
              ${corpo.tarefa_id ?? null}::uuid, ${corpo.microetapa_id ?? null}::uuid,
              ${corpo.motivo}, ${corpo.texto ?? ''})
      RETURNING id`;
    if (!novo) throw new Error('Falha ao enviar o pedido de ajuda.');
    await auditar(tx, sessao, 'ajuda.pedida', `pedido_ajuda:${novo.id}`, {
      destino: corpo.destino,
      motivo: corpo.motivo,
    });
    resposta.code(201);
    return { id: novo.id };
  });

  // Atender: o professor a quem o pedido foi feito (com vínculo ativo), ou o Pedagógico se foi à equipe
  rota(
    'post',
    '/ajuda/:id/atender',
    podeAtenderAjuda,
    { params: idParam, corpo: corpoAtender },
    async ({ tx, sessao, params, corpo, resposta }) => {
      const [p] = await tx.$queryRaw<
        {
          destino: string;
          professor_id: string | null;
          turma_id: string | null;
          disciplina_id: string | null;
          estado: string;
        }[]
      >`SELECT destino, professor_id, turma_id, disciplina_id, estado FROM pedido_ajuda WHERE id = ${params.id}::uuid`;
      const eu = sessao.usuarioId;
      let meu = false;
      if (p && sessao.perfil === 'pedagogico') meu = p.destino === 'pedagogico';
      if (p && sessao.perfil === 'professor' && p.professor_id === eu) {
        const [v] = await tx.$queryRaw<Linha[]>`
          SELECT 1 FROM vinculo WHERE tipo = 'professor_turma' AND usuario_id = ${eu}::uuid
             AND turma_id = ${p.turma_id}::uuid AND disciplina_id = ${p.disciplina_id}::uuid AND desativado_em IS NULL`;
        meu = Boolean(v);
      }
      // Pedido de outra pessoa: mesma resposta de "não existe" (não revela que o pedido existe)
      if (!p || !meu) {
        if (p) await auditar(tx, sessao, 'ajuda.atendimento_negado', `pedido_ajuda:${params.id}`);
        return resposta.code(404).send({ erro: 'Não encontrado.' });
      }
      if (p.estado !== 'aberto')
        return resposta.code(409).send({ erro: 'Este pedido já foi atendido.' });
      await tx.$executeRaw`
        UPDATE pedido_ajuda SET estado = 'atendido', atendido_por = ${eu}::uuid, atendido_em = now(),
               resposta = ${corpo.resposta ?? ''}
         WHERE id = ${params.id}::uuid AND estado = 'aberto'`;
      await auditar(tx, sessao, 'ajuda.atendida', `pedido_ajuda:${params.id}`, {
        com_resposta: Boolean(corpo.resposta),
      });
      return undefined;
    },
  );
}

// Itens de ajuda para a caixa do sino (usado em avisos/rotas.ts). Mesmos limites da matriz v6.
export async function itensDeAjuda(tx: ClienteTransacao, sessao: SessaoAtiva): Promise<Linha[]> {
  const eu = sessao.usuarioId;
  if (sessao.perfil === 'aluno') {
    // Os pedidos do próprio aluno. "Visto" só conta para a resposta (pedido aberto não gera contagem).
    const linhas = await tx.$queryRaw<Linha[]>`
      SELECT a.id, a.destino, a.motivo, a.texto, a.estado, a.resposta,
             pr.nome AS professor_nome, d.nome AS disciplina_nome, at.nome AS atendido_por_nome,
             tf.titulo AS tarefa_titulo, me.texto AS etapa_texto,
             to_char(coalesce(a.atendido_em, a.criado_em) AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia,
             (a.estado = 'aberto' OR EXISTS (SELECT 1 FROM aviso_visto v WHERE v.usuario_id = ${eu}::uuid
                                              AND v.ajuda_id = a.id)) AS visto
        FROM pedido_ajuda a
        LEFT JOIN usuario pr ON pr.id = a.professor_id
        LEFT JOIN usuario at ON at.id = a.atendido_por
        LEFT JOIN disciplina d ON d.id = a.disciplina_id
        LEFT JOIN tarefa tf ON tf.id = a.tarefa_id
        LEFT JOIN microetapa me ON me.id = a.microetapa_id
       WHERE a.aluno_id = ${eu}::uuid
       ORDER BY coalesce(a.atendido_em, a.criado_em) DESC LIMIT 30`;
    return linhas.map((l) => ({ ...l, tipo: 'ajuda_minha' }));
  }
  if (sessao.perfil !== 'professor' && sessao.perfil !== 'pedagogico') return [];
  const professor = sessao.perfil === 'professor';
  const linhas = await tx.$queryRaw<Linha[]>`
    SELECT a.id, a.destino, a.motivo, a.texto, al.nome AS aluno_nome, t.nome AS turma_nome,
           d.nome AS disciplina_nome, tf.titulo AS tarefa_titulo, me.texto AS etapa_texto,
           to_char(a.criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia,
           EXISTS (SELECT 1 FROM aviso_visto v WHERE v.usuario_id = ${eu}::uuid AND v.ajuda_id = a.id) AS visto
      FROM pedido_ajuda a
      JOIN usuario al ON al.id = a.aluno_id
      LEFT JOIN turma t ON t.id = a.turma_id
      LEFT JOIN disciplina d ON d.id = a.disciplina_id
      LEFT JOIN tarefa tf ON tf.id = a.tarefa_id
      LEFT JOIN microetapa me ON me.id = a.microetapa_id
     WHERE a.estado = 'aberto' AND (
             (${professor}::boolean AND a.destino = 'professor' AND a.professor_id = ${eu}::uuid
               AND EXISTS (SELECT 1 FROM vinculo pv WHERE pv.tipo = 'professor_turma' AND pv.usuario_id = ${eu}::uuid
                              AND pv.turma_id = a.turma_id AND pv.disciplina_id = a.disciplina_id
                              AND pv.desativado_em IS NULL))
          OR (NOT ${professor}::boolean AND a.destino = 'pedagogico'))
     ORDER BY a.criado_em DESC LIMIT 50`;
  return linhas.map((l) => ({ ...l, tipo: 'ajuda_aberta' }));
}
