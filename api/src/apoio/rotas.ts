import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registrarAuditoria } from '../auditoria/auditoria.js';
import type { SessaoAtiva } from '../auth/autenticacao.js';
import {
  podeAcompanharAlunos,
  podeAdministrarDificuldade,
  podeUsarCartoes,
} from '../auth/politica.js';
import {
  type ClienteTransacao,
  type withTenant as WithTenant,
  withTenant,
} from '../banco/withTenant.js';
import { criarRespostaAdiada, enviarGuardada } from '../banco/resposta-adiada.js';

// Apoio ao aluno (20d): dificuldade de 0 a 10, a visão do Apoio Pedagógico/NAPNE e os cards de resumo.
// A dificuldade é a percepção do aluno, pedida pelo NAPNE para acompanhar e ajudar o aluno (A-064, A-065, A-066).
// Não é avaliação nem diagnóstico. A equipe lê UM aluno por vez: não há lista com valores, média, ordem por
// dificuldade nem comparação entre alunos. Toda leitura pela equipe é auditada (sem o valor).
type Banco = Parameters<typeof WithTenant>[0];
type Exigir = (req: FastifyRequest, res: FastifyReply) => Promise<SessaoAtiva | null>;
type Opcoes = { banco: Banco; exigirSessao: Exigir };
type Linha = Record<string, unknown>;

export const LIMITE_CARTOES = 20;
const uuid = z.uuid();
const idParam = z.strictObject({ id: uuid });
const nota = z.number().int().min(0).max(10);
// Só texto: sem link, e-mail nem HTML
const semLink = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((t) => !/(https?:|www\.|:\/\/|@|[<>])/i.test(t), 'Não use links.');
const MODELOS = ['conceito', 'passo_a_passo', 'formula', 'pergunta_resposta'] as const;
const camposCartao = {
  modelo: z.enum(MODELOS),
  titulo: semLink(80),
  frente: semLink(500),
  verso: semLink(500),
};
const corpoCartao = z
  .strictObject({
    ...camposCartao,
    tarefa_id: uuid.optional(),
    disciplina_id: uuid.optional(),
  })
  .refine((c) => (c.tarefa_id === undefined) !== (c.disciplina_id === undefined), {
    message: 'Informe a tarefa ou a disciplina.',
  });
const consultaCartoes = z.strictObject({
  tarefa_id: uuid.optional(),
  disciplina_id: uuid.optional(),
});

export function registrarApoio(app: FastifyInstance, opcoes: Opcoes): void {
  const auditar = (tx: ClienteTransacao, sessao: SessaoAtiva, acao: string, alvo: string) =>
    registrarAuditoria(tx, {
      instituicaoId: sessao.instituicaoId,
      ator: `usuario:${sessao.usuarioId}`,
      acao,
      alvo,
    });

  // Deny by default: perfil sem permissão (ou sessão incompleta) é negado e a tentativa é auditada
  function rota<
    P extends z.ZodType = z.ZodUndefined,
    B extends z.ZodType = z.ZodUndefined,
    Q extends z.ZodType = z.ZodUndefined,
  >(
    metodo: 'get' | 'post' | 'put' | 'patch' | 'delete',
    caminho: string,
    permite: (perfil: string) => boolean,
    esquemas: { params?: P; corpo?: B; consulta?: Q },
    funcao: (c: {
      tx: ClienteTransacao;
      sessao: SessaoAtiva;
      params: z.infer<P>;
      corpo: z.infer<B>;
      consulta: z.infer<Q>;
      resposta: FastifyReply;
    }) => Promise<unknown>,
  ): void {
    app[metodo](caminho, async (req, res) => {
      const sessao = await opcoes.exigirSessao(req, res);
      if (!sessao) return res;
      if (sessao.nivel !== 'completo' || !permite(sessao.perfil)) {
        await withTenant(opcoes.banco, { instituicaoId: sessao.instituicaoId }, (tx) =>
          auditar(tx, sessao, 'apoio.acesso_negado', `${metodo.toUpperCase()} ${caminho}`),
        );
        return res.code(403).send({ erro: 'Sem permissão.' });
      }
      const ler = (esquema: z.ZodType | undefined, valor: unknown) =>
        esquema ? esquema.safeParse(valor) : ({ success: true, data: undefined } as const);
      const params = ler(esquemas.params, req.params);
      const corpo = ler(esquemas.corpo, req.body ?? {});
      const consulta = ler(esquemas.consulta, req.query);
      if (!params.success || !corpo.success || !consulta.success) {
        const links =
          !corpo.success && corpo.error.issues.some((i) => i.message === 'Não use links.');
        return res
          .code(400)
          .send({ erro: links ? 'O texto não pode ter links, e-mail nem HTML.' : 'Dados inválidos.' });
      }
      // F-056: a resposta guardada só sai depois do COMMIT
      const adiada = criarRespostaAdiada();
      const saida = await withTenant(opcoes.banco, { instituicaoId: sessao.instituicaoId }, (tx) =>
        funcao({
          tx,
          sessao,
          params: params.data as never,
          corpo: corpo.data as never,
          consulta: consulta.data as never,
          resposta: adiada.resposta as unknown as FastifyReply,
        }),
      );
      const enviada = enviarGuardada(res, adiada.guardado());
      if (enviada) return enviada;
      return saida === undefined ? res.code(204).send() : saida;
    });
  }
  const naoAchou = (c: { resposta: FastifyReply }) =>
    c.resposta.code(404).send({ erro: 'Não encontrado.' });

  // ---------- Dificuldade da disciplina (o aluno marca; null limpa) ----------
  rota(
    'put',
    '/minhas-disciplinas/:id/dificuldade',
    podeAdministrarDificuldade,
    { params: idParam, corpo: z.strictObject({ dificuldade: nota.nullable() }) },
    async (c) => {
      const n = await c.tx.$executeRaw`
        UPDATE disciplina_aluno SET dificuldade = ${c.corpo.dificuldade}::smallint, atualizado_em = now()
         WHERE id = ${c.params.id}::uuid AND usuario_id = ${c.sessao.usuarioId}::uuid AND desativado_em IS NULL`;
      if (n === 0) return naoAchou(c);
      await auditar(c.tx, c.sessao, 'dificuldade.alterada', `disciplina_aluno:${c.params.id}`);
      return { id: c.params.id, dificuldade: c.corpo.dificuldade };
    },
  );

  // ---------- Visão da equipe (Pedagógico/NAPNE): um aluno por vez ----------
  // Lista de alunos só com o nome, sem nenhum valor
  rota('get', '/apoio/alunos', podeAcompanharAlunos, {}, async ({ tx }) => ({
    alunos: await tx.$queryRaw<Linha[]>`
      SELECT id, nome FROM usuario
       WHERE perfil = 'aluno' AND situacao = 'ativo' AND desativado_em IS NULL
       ORDER BY lower(nome), id`,
  }));

  rota(
    'get',
    '/apoio/alunos/:id/dificuldades',
    podeAcompanharAlunos,
    { params: idParam },
    async (c) => {
      const [aluno] = await c.tx.$queryRaw<Linha[]>`
        SELECT id, nome FROM usuario
         WHERE id = ${c.params.id}::uuid AND perfil = 'aluno' AND situacao = 'ativo' AND desativado_em IS NULL`;
      if (!aluno) return naoAchou(c);
      // Ordem por nome e por prazo, nunca por dificuldade
      const disciplinas = await c.tx.$queryRaw<Linha[]>`
        SELECT id, nome, dificuldade FROM disciplina_aluno
         WHERE usuario_id = ${c.params.id}::uuid AND desativado_em IS NULL AND dificuldade IS NOT NULL
         ORDER BY nome_busca`;
      const tarefas = await c.tx.$queryRaw<Linha[]>`
        SELECT id, titulo, disciplina, prazo::text AS prazo, situacao, dificuldade FROM tarefa
         WHERE usuario_id = ${c.params.id}::uuid AND desativado_em IS NULL AND dificuldade IS NOT NULL
         ORDER BY prazo NULLS LAST, criado_em`;
      await auditar(c.tx, c.sessao, 'dificuldade.lida', `usuario:${c.params.id}`);
      return { aluno, disciplinas, tarefas };
    },
  );

  // ---------- Cards de resumo (só do aluno) ----------
  const listarCartoes = (
    tx: ClienteTransacao,
    usuarioId: string,
    tarefaId: string | null,
    disciplinaId: string | null,
    soId: string | null = null,
  ) =>
    tx.$queryRaw<Linha[]>`
      SELECT c.id, c.modelo, c.titulo, c.frente, c.verso, c.tarefa_id, c.disciplina_aluno_id AS disciplina_id,
             t.titulo AS tarefa_titulo, d.nome AS disciplina_nome
        FROM cartao_resumo c
        LEFT JOIN tarefa t ON t.instituicao_id = c.instituicao_id AND t.id = c.tarefa_id
        LEFT JOIN disciplina_aluno d ON d.instituicao_id = c.instituicao_id AND d.id = c.disciplina_aluno_id
       WHERE c.usuario_id = ${usuarioId}::uuid AND c.desativado_em IS NULL
         AND (${tarefaId}::uuid IS NULL OR c.tarefa_id = ${tarefaId}::uuid)
         AND (${disciplinaId}::uuid IS NULL OR c.disciplina_aluno_id = ${disciplinaId}::uuid)
         AND (${soId}::uuid IS NULL OR c.id = ${soId}::uuid)
       ORDER BY c.criado_em, c.id`;

  rota(
    'get',
    '/cartoes-resumo',
    podeUsarCartoes,
    { consulta: consultaCartoes },
    async ({ tx, sessao, consulta }) => ({
      limite: LIMITE_CARTOES,
      cartoes: await listarCartoes(
        tx,
        sessao.usuarioId,
        consulta.tarefa_id ?? null,
        consulta.disciplina_id ?? null,
      ),
    }),
  );

  rota('post', '/cartoes-resumo', podeUsarCartoes, { corpo: corpoCartao }, async (c) => {
    const { tx, sessao, corpo, resposta } = c;
    // O alvo precisa ser do próprio aluno e estar ativo
    const [alvo] = corpo.tarefa_id
      ? await tx.$queryRaw<Linha[]>`
          SELECT id FROM tarefa WHERE id = ${corpo.tarefa_id}::uuid AND usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL`
      : await tx.$queryRaw<Linha[]>`
          SELECT id FROM disciplina_aluno WHERE id = ${corpo.disciplina_id as string}::uuid AND usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL`;
    if (!alvo) return resposta.code(404).send({ erro: 'Tarefa ou disciplina não encontrada.' });
    const [q] = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM cartao_resumo
       WHERE usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL
         AND (${corpo.tarefa_id ?? null}::uuid IS NULL OR tarefa_id = ${corpo.tarefa_id ?? null}::uuid)
         AND (${corpo.disciplina_id ?? null}::uuid IS NULL OR disciplina_aluno_id = ${corpo.disciplina_id ?? null}::uuid)`;
    if ((q?.n ?? 0) >= LIMITE_CARTOES)
      return resposta.code(409).send({ erro: `Você chegou ao limite de ${LIMITE_CARTOES} cards aqui.` });
    const [novo] = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO cartao_resumo (instituicao_id, usuario_id, tarefa_id, disciplina_aluno_id, modelo, titulo, frente, verso)
      VALUES (${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, ${corpo.tarefa_id ?? null}::uuid,
              ${corpo.disciplina_id ?? null}::uuid, ${corpo.modelo}, ${corpo.titulo}, ${corpo.frente}, ${corpo.verso})
      RETURNING id`;
    if (!novo) throw new Error('Falha ao criar o card.');
    await auditar(tx, sessao, 'cartao.criado', `cartao_resumo:${novo.id}`);
    const [cartao] = await listarCartoes(tx, sessao.usuarioId, null, null, novo.id);
    return resposta.code(201).send({ cartao });
  });

  rota(
    'patch',
    '/cartoes-resumo/:id',
    podeUsarCartoes,
    { params: idParam, corpo: z.strictObject(camposCartao).partial() },
    async (c) => {
      const { tx, sessao, params, corpo } = c;
      const n = await tx.$executeRaw`
        UPDATE cartao_resumo SET
          modelo = coalesce(${corpo.modelo ?? null}::text, modelo),
          titulo = coalesce(${corpo.titulo ?? null}::text, titulo),
          frente = coalesce(${corpo.frente ?? null}::text, frente),
          verso = coalesce(${corpo.verso ?? null}::text, verso),
          atualizado_em = now()
         WHERE id = ${params.id}::uuid AND usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL`;
      if (n === 0) return naoAchou(c);
      await auditar(tx, sessao, 'cartao.editado', `cartao_resumo:${params.id}`);
      const [cartao] = await listarCartoes(tx, sessao.usuarioId, null, null, params.id);
      return { cartao };
    },
  );

  // Desativar: nada se apaga de verdade
  rota('delete', '/cartoes-resumo/:id', podeUsarCartoes, { params: idParam }, async (c) => {
    const n = await c.tx.$executeRaw`
      UPDATE cartao_resumo SET desativado_em = now(), atualizado_em = now()
       WHERE id = ${c.params.id}::uuid AND usuario_id = ${c.sessao.usuarioId}::uuid AND desativado_em IS NULL`;
    if (n === 0) return naoAchou(c);
    await auditar(c.tx, c.sessao, 'cartao.desativado', `cartao_resumo:${c.params.id}`);
    return undefined;
  });
}
