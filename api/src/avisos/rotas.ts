import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { itensDeAjuda } from '../ajuda/rotas.js';
import { registrarAuditoria } from '../auditoria/auditoria.js';
import type { SessaoAtiva } from '../auth/autenticacao.js';
import { podeLerAvisoEscolar, podeLerCaixa, podePublicarAviso } from '../auth/politica.js';
import {
  type ClienteTransacao,
  type withTenant as WithTenant,
  withTenant,
} from '../banco/withTenant.js';
import { itensDeSuporte } from '../conta/rotas.js';

// Sino de mensagens (L16): caixa por perfil, "visto" e avisos curtos só de leitura.
// A caixa só reaproveita pedido_revisao (L15). Mostra estado, nota atual e data; nunca o motivo da revisão nem
// versões antigas (A-027). O motivo de "mantida" aparece só a quem fez o pedido. Sem ranking, sem comparação.
type Banco = Parameters<typeof WithTenant>[0];
type Exigir = (req: FastifyRequest, res: FastifyReply) => Promise<SessaoAtiva | null>;
type Opcoes = { banco: Banco; exigirSessao: Exigir };
type Linha = Record<string, unknown>;

const uuid = z.uuid();
const idParam = z.strictObject({ id: uuid });
// Texto do aviso: curto, sem links e sem anexos
const texto = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((t) => !/(https?:|www\.|:\/\/)/i.test(t), 'Não use links.');
const corpoAviso = z.strictObject({ texto, turma_id: uuid.optional() });

export type ItemCaixa = {
  tipo: 'pedido_aberto' | 'resposta' | 'aviso' | 'ajuda_aberta' | 'ajuda_minha' | 'suporte_aberto';
  id: string;
  visto: boolean;
  dia: string; // AAAA-MM-DD; a tela mostra dia/mês
  [campo: string]: unknown;
};

export function registrarAvisos(app: FastifyInstance, opcoes: Opcoes): void {
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

  // Rota com deny by default: perfil sem permissão (ou sessão incompleta) é negado e a tentativa é auditada.
  // A resposta sai depois do commit: o código é definido aqui e o corpo é devolvido.
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
          auditar(tx, sessao, 'avisos.acesso_negado', `${metodo.toUpperCase()} ${caminho}`, {
            perfil: sessao.perfil,
          }),
        );
        return res.code(403).send({ erro: 'Sem permissão.' });
      }
      const params = esquemas.params ? esquemas.params.safeParse(req.params) : null;
      const corpo = esquemas.corpo ? esquemas.corpo.safeParse(req.body) : null;
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

  // Itens da caixa de quem está logado. Cada perfil recebe só o que a matriz v5 permite:
  //  - professor: pedidos abertos das suas turmas e disciplinas;
  //  - os outros: a resposta aos pedidos que a própria pessoa fez (estado, nota atual, data);
  //  - aluno e responsável: também os avisos curtos da turma ou da instituição.
  async function itensDaCaixa(tx: ClienteTransacao, sessao: SessaoAtiva): Promise<ItemCaixa[]> {
    const eu = sessao.usuarioId;
    const itens: ItemCaixa[] = [];
    if (sessao.perfil === 'professor') {
      const abertos = await tx.$queryRaw<Linha[]>`
        SELECT p.id, p.perfil_pedinte, u.nome AS pedinte_nome, p.texto,
               to_char(p.criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia,
               a.nome AS aluno_nome, t.nome AS turma_nome, d.nome AS disciplina_nome,
               n.descricao AS nota_descricao, vn.valor::float8 AS valor_atual,
               (n.professor_id = ${eu}::uuid) AS pode_responder,
               EXISTS (SELECT 1 FROM aviso_visto v WHERE v.usuario_id = ${eu}::uuid AND v.pedido_id = p.id) AS visto
          FROM pedido_revisao p
          JOIN nota_oficial n ON n.id = p.nota_id
          JOIN usuario u ON u.id = p.pedido_por
          JOIN usuario a ON a.id = n.aluno_id
          JOIN turma t ON t.id = n.turma_id
          JOIN disciplina d ON d.id = n.disciplina_id
          JOIN LATERAL (SELECT valor FROM nota_oficial_versao vv
                         WHERE vv.instituicao_id = n.instituicao_id AND vv.nota_id = n.id
                         ORDER BY numero DESC LIMIT 1) vn ON true
         WHERE p.estado = 'aberto'
           AND EXISTS (SELECT 1 FROM vinculo pv WHERE pv.tipo = 'professor_turma' AND pv.usuario_id = ${eu}::uuid
                          AND pv.turma_id = n.turma_id AND pv.disciplina_id = n.disciplina_id AND pv.desativado_em IS NULL)
         ORDER BY p.criado_em DESC LIMIT 50`;
      for (const l of abertos) itens.push({ ...l, tipo: 'pedido_aberto' } as ItemCaixa);
    } else {
      // Respostas ao que a própria pessoa pediu. Motivo só em "mantida"; revisão: sem motivo e sem versão antiga.
      const respostas = await tx.$queryRaw<Linha[]>`
        SELECT p.id, p.estado,
               to_char(p.respondido_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia,
               CASE WHEN p.estado = 'mantida' THEN p.motivo_resposta ELSE '' END AS motivo,
               a.nome AS aluno_nome, d.nome AS disciplina_nome, n.descricao AS nota_descricao,
               vn.valor::float8 AS valor_atual,
               EXISTS (SELECT 1 FROM aviso_visto v WHERE v.usuario_id = ${eu}::uuid AND v.pedido_id = p.id) AS visto
          FROM pedido_revisao p
          JOIN nota_oficial n ON n.id = p.nota_id
          JOIN usuario a ON a.id = n.aluno_id
          JOIN disciplina d ON d.id = n.disciplina_id
          JOIN LATERAL (SELECT valor FROM nota_oficial_versao vv
                         WHERE vv.instituicao_id = n.instituicao_id AND vv.nota_id = n.id
                         ORDER BY numero DESC LIMIT 1) vn ON true
         WHERE p.pedido_por = ${eu}::uuid AND p.estado <> 'aberto'
         ORDER BY p.respondido_em DESC LIMIT 50`;
      for (const l of respostas) itens.push({ ...l, tipo: 'resposta' } as ItemCaixa);
    }
    if (podeLerAvisoEscolar(sessao.perfil)) {
      const perfil = sessao.perfil;
      const avisos = await tx.$queryRaw<Linha[]>`
        SELECT s.id, s.escopo, t.nome AS turma_nome, s.texto, u.nome AS autor_nome,
               to_char(s.criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia,
               EXISTS (SELECT 1 FROM aviso_visto v WHERE v.usuario_id = ${eu}::uuid AND v.aviso_id = s.id) AS visto
          FROM aviso_escolar s
          JOIN usuario u ON u.id = s.autor_id
          LEFT JOIN turma t ON t.id = s.turma_id
         WHERE s.desativado_em IS NULL AND (
                 s.escopo = 'instituicao'
              OR (${perfil} = 'aluno' AND EXISTS (
                    SELECT 1 FROM vinculo av WHERE av.tipo = 'aluno_turma' AND av.usuario_id = ${eu}::uuid
                       AND av.turma_id = s.turma_id AND av.desativado_em IS NULL))
              OR (${perfil} = 'responsavel' AND EXISTS (
                    SELECT 1 FROM vinculo r
                      JOIN vinculo av ON av.tipo = 'aluno_turma' AND av.usuario_id = r.aluno_id AND av.desativado_em IS NULL
                     WHERE r.tipo = 'responsavel_aluno' AND r.usuario_id = ${eu}::uuid AND r.desativado_em IS NULL
                       AND av.turma_id = s.turma_id)))
         ORDER BY s.criado_em DESC LIMIT 50`;
      for (const l of avisos) itens.push({ ...l, tipo: 'aviso' } as ItemCaixa);
    }
    // Pedidos de ajuda (L17): o aluno vê os próprios; professor e Pedagógico, os que esperam resposta deles
    for (const l of await itensDeAjuda(tx, sessao)) itens.push(l as ItemCaixa);
    // Pedidos de suporte (L17c): o Admin e o Pedagógico veem os que esperam resposta
    for (const l of await itensDeSuporte(tx, sessao)) itens.push(l as ItemCaixa);
    // Não vistos primeiro; dentro de cada grupo, o mais recente primeiro
    return itens.sort(
      (x, y) => Number(x.visto) - Number(y.visto) || (x.dia < y.dia ? 1 : x.dia > y.dia ? -1 : 0),
    );
  }

  // ---------- Caixa do sino amarelo ----------
  rota('get', '/caixa', podeLerCaixa, {}, async ({ tx, sessao }) => {
    const itens = await itensDaCaixa(tx, sessao);
    return { itens, nao_vistos: itens.filter((i) => !i.visto).length };
  });

  // Abrir a caixa marca os itens como vistos. Só grava (e audita) quando algum item muda de estado.
  rota('post', '/caixa/vistos', podeLerCaixa, {}, async ({ tx, sessao }) => {
    const novos = (await itensDaCaixa(tx, sessao)).filter((i) => !i.visto);
    const ajuda = (i: ItemCaixa) => i.tipo === 'ajuda_aberta' || i.tipo === 'ajuda_minha';
    const pedidos = novos
      .filter((i) => i.tipo !== 'aviso' && i.tipo !== 'suporte_aberto' && !ajuda(i))
      .map((i) => i.id);
    const suportes = novos.filter((i) => i.tipo === 'suporte_aberto').map((i) => i.id);
    const avisos = novos.filter((i) => i.tipo === 'aviso').map((i) => i.id);
    const ajudas = novos.filter(ajuda).map((i) => i.id);
    if (pedidos.length) {
      await tx.$executeRaw`
        INSERT INTO aviso_visto (instituicao_id, usuario_id, pedido_id)
        SELECT ${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, x FROM unnest(${pedidos}::uuid[]) AS x
        ON CONFLICT DO NOTHING`;
    }
    if (avisos.length) {
      await tx.$executeRaw`
        INSERT INTO aviso_visto (instituicao_id, usuario_id, aviso_id)
        SELECT ${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, x FROM unnest(${avisos}::uuid[]) AS x
        ON CONFLICT DO NOTHING`;
    }
    if (ajudas.length) {
      await tx.$executeRaw`
        INSERT INTO aviso_visto (instituicao_id, usuario_id, ajuda_id)
        SELECT ${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, x FROM unnest(${ajudas}::uuid[]) AS x
        ON CONFLICT DO NOTHING`;
    }
    if (suportes.length) {
      await tx.$executeRaw`
        INSERT INTO aviso_visto (instituicao_id, usuario_id, suporte_id)
        SELECT ${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, x FROM unnest(${suportes}::uuid[]) AS x
        ON CONFLICT DO NOTHING`;
    }
    if (novos.length) {
      await auditar(tx, sessao, 'caixa.aberta', `usuario:${sessao.usuarioId}`, {
        pedidos: pedidos.length,
        avisos: avisos.length,
        ajudas: ajudas.length,
        suportes: suportes.length,
      });
    }
    return { marcados: novos.length };
  });

  // ---------- Avisos curtos (Pedagógico para uma turma; Admin para a instituição) ----------
  rota('post', '/avisos-escolares', podePublicarAviso, { corpo: corpoAviso }, async (c) => {
    const { tx, sessao, corpo, resposta } = c;
    const pedagogico = sessao.perfil === 'pedagogico';
    // Pedagógico escolhe uma turma da instituição; Admin fala com a instituição inteira (sem turma)
    if (pedagogico !== (corpo.turma_id !== undefined)) {
      return resposta.code(400).send({
        erro: pedagogico
          ? 'Escolha a turma do aviso.'
          : 'O aviso do Admin vale para toda a instituição.',
      });
    }
    if (corpo.turma_id) {
      const [turma] = await tx.$queryRaw<Linha[]>`
        SELECT 1 FROM turma WHERE id = ${corpo.turma_id}::uuid AND desativado_em IS NULL`;
      if (!turma) return resposta.code(404).send({ erro: 'Não encontrado.' });
    }
    const [novo] = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO aviso_escolar (instituicao_id, autor_id, autor_perfil, escopo, turma_id, texto)
      VALUES (${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, ${sessao.perfil},
              ${pedagogico ? 'turma' : 'instituicao'}, ${corpo.turma_id ?? null}::uuid, ${corpo.texto})
      RETURNING id`;
    if (!novo) throw new Error('Falha ao publicar o aviso.');
    await auditar(tx, sessao, 'aviso.publicado', `aviso:${novo.id}`, {
      escopo: pedagogico ? 'turma' : 'instituicao',
      turma_id: corpo.turma_id ?? null,
    });
    resposta.code(201);
    return { id: novo.id };
  });

  // Turmas ativas da instituição para o Pedagógico escolher onde publicar (só nome e ano; nada de alunos)
  rota('get', '/avisos-escolares/turmas', podePublicarAviso, {}, async ({ tx }) => ({
    turmas: await tx.$queryRaw<Linha[]>`
      SELECT id, nome, ano_letivo FROM turma WHERE desativado_em IS NULL ORDER BY ano_letivo DESC, nome`,
  }));

  // Lista os avisos que a própria pessoa publicou (e, para o Admin, os da instituição)
  rota('get', '/avisos-escolares', podePublicarAviso, {}, async ({ tx, sessao }) => {
    const todos = sessao.perfil === 'admin';
    const avisos = await tx.$queryRaw<Linha[]>`
      SELECT s.id, s.escopo, t.nome AS turma_nome, s.texto, u.nome AS autor_nome,
             to_char(s.criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia,
             (s.desativado_em IS NULL) AS ativo
        FROM aviso_escolar s
        JOIN usuario u ON u.id = s.autor_id
        LEFT JOIN turma t ON t.id = s.turma_id
       WHERE (${todos}::boolean OR s.autor_id = ${sessao.usuarioId}::uuid)
       ORDER BY s.criado_em DESC LIMIT 100`;
    return { avisos };
  });

  // Desativar (nada se apaga): o autor, ou o Admin da instituição
  rota(
    'post',
    '/avisos-escolares/:id/desativar',
    podePublicarAviso,
    { params: idParam },
    async ({ tx, sessao, params, resposta }) => {
      const [aviso] = await tx.$queryRaw<{ autor_id: string; ativo: boolean }[]>`
        SELECT autor_id, (desativado_em IS NULL) AS ativo FROM aviso_escolar WHERE id = ${params.id}::uuid`;
      if (!aviso) return resposta.code(404).send({ erro: 'Não encontrado.' });
      if (aviso.autor_id !== sessao.usuarioId && sessao.perfil !== 'admin') {
        await auditar(tx, sessao, 'aviso.desativacao_negada', `aviso:${params.id}`);
        resposta.code(403);
        return { erro: 'Só quem publicou o aviso, ou o Admin, pode desativá-lo.' };
      }
      if (!aviso.ativo) return resposta.code(409).send({ erro: 'Este aviso já foi desativado.' });
      await tx.$executeRaw`UPDATE aviso_escolar SET desativado_em = now() WHERE id = ${params.id}::uuid AND desativado_em IS NULL`;
      await auditar(tx, sessao, 'aviso.desativado', `aviso:${params.id}`);
      return undefined;
    },
  );
}
