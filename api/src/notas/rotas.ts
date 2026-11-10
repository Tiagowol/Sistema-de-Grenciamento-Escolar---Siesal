import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registrarAuditoria } from '../auditoria/auditoria.js';
import type { SessaoAtiva } from '../auth/autenticacao.js';
import {
  podeLancarNota,
  podeLerNotas,
  podePedirRevisao,
  podeResponderPedido,
  podeVerHistoricoNotas,
} from '../auth/politica.js';
import {
  type ClienteTransacao,
  type withTenant as WithTenant,
  withTenant,
} from '../banco/withTenant.js';

// Notas oficiais (L15): lançamento e revisão pelo professor, leitura por perfil e pedido de revisão.
// Nada se apaga: a revisão grava nova versão. Sem ranking, sem média da turma, sem comparação entre alunos.
type Banco = Parameters<typeof WithTenant>[0];
type Exigir = (req: FastifyRequest, res: FastifyReply) => Promise<SessaoAtiva | null>;
type Opcoes = { banco: Banco; exigirSessao: Exigir };
type Linha = Record<string, unknown>;

const uuid = z.uuid();
const idParam = z.strictObject({ id: uuid });
const dia = z.iso.date();
// Valor de 0 a 10 com uma casa decimal
const valorNota = z
  .number()
  .min(0)
  .max(10)
  .transform((v) => Math.round(v * 10) / 10);
const motivo = z.string().trim().min(1).max(300);
// Texto do pedido: curto, sem links e sem anexos
const textoPedido = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((t) => !/(https?:|www\.|:\/\/)/i.test(t), 'Não use links.');
const corpoLancar = z.strictObject({
  aluno_id: uuid,
  turma_id: uuid,
  disciplina_id: uuid,
  descricao: z.string().trim().max(120).optional(),
  valor: valorNota,
  dia,
});
const corpoRevisao = z.strictObject({ valor: valorNota, motivo, pedido_id: uuid.optional() });
const corpoPedido = z.strictObject({ texto: textoPedido });
const corpoManter = z.strictObject({ motivo });

export function registrarNotas(app: FastifyInstance, opcoes: Opcoes): void {
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
      // Deny by default: perfil sem permissão (ou sessão incompleta) é negado e a tentativa é auditada
      if (sessao.nivel !== 'completo' || !permite(sessao.perfil)) {
        await withTenant(opcoes.banco, { instituicaoId: sessao.instituicaoId }, (tx) =>
          registrarAuditoria(tx, {
            instituicaoId: sessao.instituicaoId,
            ator: `usuario:${sessao.usuarioId}`,
            acao: 'notas.acesso_negado',
            alvo: `${metodo.toUpperCase()} ${caminho}`,
            depois: { perfil: sessao.perfil },
          }),
        );
        return res.code(403).send({ erro: 'Sem permissão.' });
      }
      const ler = (esquema: z.ZodType | undefined, valor: unknown) =>
        esquema ? esquema.safeParse(valor) : ({ success: true, data: undefined } as const);
      const params = ler(esquemas.params, req.params);
      const corpo = ler(esquemas.corpo, req.body);
      if (!params.success || !corpo.success) {
        const detalhe = [params, corpo].flatMap((r) => (r.success ? [] : r.error.issues));
        const links = detalhe.some((i) => i.message === 'Não use links.');
        return res.code(400).send({
          erro: links ? 'O texto não pode ter links.' : 'Dados inválidos.',
        });
      }
      const saida = await withTenant(opcoes.banco, { instituicaoId: sessao.instituicaoId }, (tx) =>
        funcao({
          tx,
          sessao,
          params: params.data as never,
          corpo: corpo.data as never,
          resposta: res,
        }),
      );
      if (res.sent) return res;
      return saida === undefined ? res.code(204).send() : saida;
    });
  }

  const auditar = (
    tx: ClienteTransacao,
    sessao: SessaoAtiva,
    acao: string,
    alvo: string,
    depois?: unknown,
    antes?: unknown,
  ) =>
    registrarAuditoria(tx, {
      instituicaoId: sessao.instituicaoId,
      ator: `usuario:${sessao.usuarioId}`,
      acao,
      alvo,
      antes,
      depois,
    });
  const naoAchou = (r: FastifyReply) => r.code(404).send({ erro: 'Não encontrado.' });
  const negar = async (
    tx: ClienteTransacao,
    sessao: SessaoAtiva,
    r: FastifyReply,
    acao: string,
    alvo: string,
    erro: string,
  ) => {
    await auditar(tx, sessao, acao, alvo);
    r.code(403); // a resposta sai depois do commit da auditoria
    return { erro };
  };

  // Notas que o usuário pode ver, com a versão atual. Perfil e vínculo decidem; aluno e responsável nunca veem
  // a nota de outra pessoa. Só a versão atual sai daqui; o histórico é uma consulta à parte.
  const notasVisiveis = (
    tx: ClienteTransacao,
    sessao: SessaoAtiva,
    filtro: { notaId?: string; turmaId?: string; disciplinaId?: string } = {},
  ) => {
    const perfil = sessao.perfil;
    const eu = sessao.usuarioId;
    return tx.$queryRaw<Linha[]>`
      SELECT n.id, n.aluno_id, a.nome AS aluno_nome, n.turma_id, t.nome AS turma_nome,
             n.disciplina_id, d.nome AS disciplina_nome, n.descricao, n.dia::text AS dia,
             v.numero AS versao, v.valor::float8 AS valor,
             to_char(v.criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS atualizada_em,
             (n.professor_id = ${eu}::uuid) AS minha,
             EXISTS (SELECT 1 FROM pedido_revisao p WHERE p.nota_id = n.id AND p.pedido_por = ${eu}::uuid
                        AND p.estado = 'aberto') AS pedido_aberto_meu
        FROM nota_oficial n
        JOIN LATERAL (SELECT numero, valor, criado_em FROM nota_oficial_versao vv
                       WHERE vv.instituicao_id = n.instituicao_id AND vv.nota_id = n.id
                       ORDER BY numero DESC LIMIT 1) v ON true
        JOIN usuario a ON a.id = n.aluno_id
        JOIN turma t ON t.id = n.turma_id
        JOIN disciplina d ON d.id = n.disciplina_id
       WHERE (
               ${perfil} IN ('admin', 'pedagogico')
            OR (${perfil} = 'aluno' AND n.aluno_id = ${eu}::uuid)
            OR (${perfil} = 'responsavel' AND EXISTS (
                  SELECT 1 FROM vinculo r WHERE r.tipo = 'responsavel_aluno' AND r.usuario_id = ${eu}::uuid
                     AND r.aluno_id = n.aluno_id AND r.desativado_em IS NULL))
            OR (${perfil} = 'professor' AND EXISTS (
                  SELECT 1 FROM vinculo pv WHERE pv.tipo = 'professor_turma' AND pv.usuario_id = ${eu}::uuid
                     AND pv.turma_id = n.turma_id AND pv.disciplina_id = n.disciplina_id AND pv.desativado_em IS NULL))
             )
         AND (${filtro.notaId ?? null}::uuid IS NULL OR n.id = ${filtro.notaId ?? null}::uuid)
         AND (${filtro.turmaId ?? null}::uuid IS NULL OR n.turma_id = ${filtro.turmaId ?? null}::uuid)
         AND (${filtro.disciplinaId ?? null}::uuid IS NULL OR n.disciplina_id = ${filtro.disciplinaId ?? null}::uuid)
       ORDER BY n.dia DESC, n.criado_em DESC
       LIMIT 300`;
  };

  // ---------- Professor: turmas e disciplinas em que leciona (vínculo professor_turma) ----------
  rota('get', '/professor/turmas', podeLancarNota, {}, async ({ tx, sessao }) => {
    const turmas = await tx.$queryRaw<Linha[]>`
      SELECT v.turma_id, t.nome AS turma_nome, t.ano_letivo, v.disciplina_id, d.nome AS disciplina_nome
        FROM vinculo v
        JOIN turma t ON t.id = v.turma_id AND t.desativado_em IS NULL
        JOIN disciplina d ON d.id = v.disciplina_id AND d.desativado_em IS NULL
       WHERE v.tipo = 'professor_turma' AND v.usuario_id = ${sessao.usuarioId}::uuid AND v.desativado_em IS NULL
       ORDER BY t.nome, d.nome`;
    const ids = [...new Set(turmas.map((t) => t.turma_id as string))];
    const alunos = ids.length
      ? await tx.$queryRaw<Linha[]>`
          SELECT v.turma_id, u.id, u.nome FROM vinculo v JOIN usuario u ON u.id = v.usuario_id
           WHERE v.tipo = 'aluno_turma' AND v.desativado_em IS NULL AND u.situacao = 'ativo'
             AND v.turma_id = ANY(${ids}::uuid[]) ORDER BY u.nome`
      : [];
    return {
      turmas: turmas.map((t) => ({
        ...t,
        alunos: alunos
          .filter((a) => a.turma_id === t.turma_id)
          .map((a) => ({ id: a.id, nome: a.nome })),
      })),
    };
  });

  // ---------- Leitura (todos os perfis escolares, cada um no seu alcance) ----------
  app.get('/notas-oficiais', async (req, res) => {
    const consulta = z
      .strictObject({ turma_id: uuid.optional(), disciplina_id: uuid.optional() })
      .safeParse(req.query);
    if (!consulta.success) return res.code(400).send({ erro: 'Dados inválidos.' });
    return listarNotas(req, res, consulta.data);
  });
  const listarNotas = async (
    req: FastifyRequest,
    res: FastifyReply,
    filtro: { turma_id?: string; disciplina_id?: string },
  ) => {
    const sessao = await opcoes.exigirSessao(req, res);
    if (!sessao) return res;
    if (sessao.nivel !== 'completo' || !podeLerNotas(sessao.perfil)) {
      await withTenant(opcoes.banco, { instituicaoId: sessao.instituicaoId }, (tx) =>
        auditar(tx, sessao, 'notas.acesso_negado', 'GET /notas-oficiais', {
          perfil: sessao.perfil,
        }),
      );
      return res.code(403).send({ erro: 'Sem permissão.' });
    }
    return withTenant(opcoes.banco, { instituicaoId: sessao.instituicaoId }, async (tx) => {
      const notas = await notasVisiveis(tx, sessao, {
        turmaId: filtro.turma_id,
        disciplinaId: filtro.disciplina_id,
      });
      // Histórico de versões: só professor (das suas turmas) e Admin. Os outros veem só a nota atual.
      const historico = podeVerHistoricoNotas(sessao.perfil);
      const ids = notas.map((n) => n.id as string);
      const versoes =
        historico && ids.length
          ? await tx.$queryRaw<Linha[]>`
              SELECT v.nota_id, v.numero, v.valor::float8 AS valor, v.motivo, u.nome AS autor_nome,
                     to_char(v.criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia
                FROM nota_oficial_versao v JOIN usuario u ON u.id = v.autor_id
               WHERE v.nota_id = ANY(${ids}::uuid[]) ORDER BY v.nota_id, v.numero DESC`
          : [];
      return {
        notas: notas.map((n) => ({
          ...n,
          // professor só revisa o que ele mesmo lançou; os outros perfis nunca
          pode_revisar: sessao.perfil === 'professor' && n.minha === true,
          ...(historico ? { versoes: versoes.filter((v) => v.nota_id === n.id) } : {}),
        })),
      };
    });
  };

  // ---------- Professor lança nota ----------
  rota('post', '/notas-oficiais', podeLancarNota, { corpo: corpoLancar }, async (c) => {
    const { tx, sessao, corpo, resposta } = c;
    const [vinc] = await tx.$queryRaw<Linha[]>`
      SELECT 1 FROM vinculo WHERE tipo = 'professor_turma' AND usuario_id = ${sessao.usuarioId}::uuid
         AND turma_id = ${corpo.turma_id}::uuid AND disciplina_id = ${corpo.disciplina_id}::uuid
         AND desativado_em IS NULL`;
    if (!vinc) {
      return negar(
        tx,
        sessao,
        resposta,
        'nota.lancamento_negado',
        `turma:${corpo.turma_id}`,
        'Você não leciona esta disciplina nesta turma.',
      );
    }
    const [aluno] = await tx.$queryRaw<Linha[]>`
      SELECT 1 FROM vinculo v JOIN usuario u ON u.id = v.usuario_id
       WHERE v.tipo = 'aluno_turma' AND v.usuario_id = ${corpo.aluno_id}::uuid AND v.turma_id = ${corpo.turma_id}::uuid
         AND v.desativado_em IS NULL AND u.situacao = 'ativo' AND u.perfil = 'aluno'`;
    if (!aluno) return resposta.code(400).send({ erro: 'Este aluno não está nesta turma.' });
    const [nova] = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO nota_oficial (instituicao_id, aluno_id, turma_id, disciplina_id, professor_id, descricao, dia)
      VALUES (${sessao.instituicaoId}::uuid, ${corpo.aluno_id}::uuid, ${corpo.turma_id}::uuid,
              ${corpo.disciplina_id}::uuid, ${sessao.usuarioId}::uuid, ${corpo.descricao ?? ''}, ${corpo.dia}::date)
      RETURNING id`;
    if (!nova) throw new Error('Falha ao lançar a nota.');
    await tx.$executeRaw`
      INSERT INTO nota_oficial_versao (instituicao_id, nota_id, numero, valor, autor_id)
      VALUES (${sessao.instituicaoId}::uuid, ${nova.id}::uuid, 1, ${corpo.valor}, ${sessao.usuarioId}::uuid)`;
    await auditar(tx, sessao, 'nota.lancada', `nota:${nova.id}`, {
      aluno_id: corpo.aluno_id,
      turma_id: corpo.turma_id,
      disciplina_id: corpo.disciplina_id,
      valor: corpo.valor,
      dia: corpo.dia,
    });
    resposta.code(201);
    return { id: nova.id };
  });

  // ---------- Professor revisa a própria nota (nova versão; nada é apagado) ----------
  rota(
    'post',
    '/notas-oficiais/:id/revisoes',
    podeLancarNota,
    { params: idParam, corpo: corpoRevisao },
    async ({ tx, sessao, params, corpo, resposta }) => {
      const [nota] = await tx.$queryRaw<
        { professor_id: string; turma_id: string; disciplina_id: string }[]
      >`SELECT professor_id, turma_id, disciplina_id FROM nota_oficial WHERE id = ${params.id}::uuid`;
      if (!nota) return naoAchou(resposta);
      const [vinc] = await tx.$queryRaw<Linha[]>`
        SELECT 1 FROM vinculo WHERE tipo = 'professor_turma' AND usuario_id = ${sessao.usuarioId}::uuid
           AND turma_id = ${nota.turma_id}::uuid AND disciplina_id = ${nota.disciplina_id}::uuid
           AND desativado_em IS NULL`;
      // Só o professor que lançou a nota a revisa, e só enquanto leciona aquela turma e disciplina
      if (nota.professor_id !== sessao.usuarioId || !vinc) {
        return negar(
          tx,
          sessao,
          resposta,
          'nota.revisao_negada',
          `nota:${params.id}`,
          'Só o professor que lançou a nota pode revisá-la.',
        );
      }
      // Trava a nota durante a revisão (duas revisões ao mesmo tempo não se misturam)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${params.id}, 1))`;
      const [atual] = await tx.$queryRaw<{ numero: number; valor: number }[]>`
        SELECT numero, valor::float8 AS valor FROM nota_oficial_versao
         WHERE nota_id = ${params.id}::uuid ORDER BY numero DESC LIMIT 1`;
      if (!atual) throw new Error('Nota sem versão.');
      if (atual.valor === corpo.valor) {
        return resposta.code(422).send({
          erro: 'O valor é igual ao da versão atual. Para manter a nota, responda ao pedido com "Manter nota".',
        });
      }
      if (corpo.pedido_id) {
        const [pedido] = await tx.$queryRaw<{ estado: string }[]>`
          SELECT estado FROM pedido_revisao WHERE id = ${corpo.pedido_id}::uuid AND nota_id = ${params.id}::uuid`;
        if (!pedido) return naoAchou(resposta);
        if (pedido.estado !== 'aberto')
          return resposta.code(409).send({ erro: 'Este pedido já foi respondido.' });
      }
      const [versao] = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO nota_oficial_versao (instituicao_id, nota_id, numero, valor, motivo, autor_id)
        VALUES (${sessao.instituicaoId}::uuid, ${params.id}::uuid, ${atual.numero + 1}, ${corpo.valor},
                ${corpo.motivo}, ${sessao.usuarioId}::uuid)
        RETURNING id`;
      if (!versao) throw new Error('Falha ao gravar a revisão.');
      await auditar(
        tx,
        sessao,
        'nota.revisada',
        `nota:${params.id}`,
        { versao: atual.numero + 1, valor: corpo.valor, motivo: corpo.motivo },
        { versao: atual.numero, valor: atual.valor },
      );
      // Fechar juntos (L16): a nova versão responde a TODOS os pedidos abertos desta nota, ligados a ela.
      // Cada pedido fechado é auditado; o motivo do professor fica guardado, mas só ele e o Admin o leem (A-027).
      const fechados = await tx.$queryRaw<{ id: string }[]>`
        UPDATE pedido_revisao SET estado = 'revisada', versao_resposta_id = ${versao.id}::uuid,
               motivo_resposta = ${corpo.motivo}, respondido_por = ${sessao.usuarioId}::uuid, respondido_em = now()
         WHERE nota_id = ${params.id}::uuid AND estado = 'aberto'
        RETURNING id`;
      for (const f of fechados) {
        await auditar(tx, sessao, 'pedido_revisao.respondido', `pedido_revisao:${f.id}`, {
          estado: 'revisada',
          versao: atual.numero + 1,
          fechado_junto: f.id !== corpo.pedido_id,
        });
      }
      resposta.code(201);
      return { versao: atual.numero + 1, pedidos_fechados: fechados.length };
    },
  );

  // ---------- Pedido de revisão ----------
  rota(
    'post',
    '/notas-oficiais/:id/pedidos',
    podePedirRevisao,
    { params: idParam, corpo: corpoPedido },
    async ({ tx, sessao, params, corpo, resposta }) => {
      // A nota precisa estar ao alcance de quem pede; fora dele a resposta é "não encontrado"
      const [nota] = await notasVisiveis(tx, sessao, { notaId: params.id });
      if (!nota) {
        await auditar(tx, sessao, 'pedido_revisao.negado', `nota:${params.id}`, {
          perfil: sessao.perfil,
        });
        resposta.code(404);
        return { erro: 'Não encontrado.' };
      }
      if (nota.pedido_aberto_meu) {
        return resposta.code(409).send({ erro: 'Você já tem um pedido aberto para esta nota.' });
      }
      const [novo] = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO pedido_revisao (instituicao_id, nota_id, pedido_por, perfil_pedinte, texto)
        VALUES (${sessao.instituicaoId}::uuid, ${params.id}::uuid, ${sessao.usuarioId}::uuid,
                ${sessao.perfil}, ${corpo.texto})
        RETURNING id`;
      if (!novo) throw new Error('Falha ao registrar o pedido.');
      await auditar(tx, sessao, 'pedido_revisao.aberto', `pedido_revisao:${novo.id}`, {
        nota_id: params.id,
        perfil: sessao.perfil,
      });
      resposta.code(201);
      return { id: novo.id };
    },
  );

  app.get('/pedidos-revisao', async (req, res) => {
    const sessao = await opcoes.exigirSessao(req, res);
    if (!sessao) return res;
    if (
      sessao.nivel !== 'completo' ||
      !(podePedirRevisao(sessao.perfil) || podeResponderPedido(sessao.perfil))
    ) {
      await withTenant(opcoes.banco, { instituicaoId: sessao.instituicaoId }, (tx) =>
        auditar(tx, sessao, 'notas.acesso_negado', 'GET /pedidos-revisao', {
          perfil: sessao.perfil,
        }),
      );
      return res.code(403).send({ erro: 'Sem permissão.' });
    }
    const eu = sessao.usuarioId;
    const ehProfessor = podeResponderPedido(sessao.perfil);
    return withTenant(opcoes.banco, { instituicaoId: sessao.instituicaoId }, async (tx) => {
      // Professor: pedidos das notas das suas turmas e disciplinas. Os outros: só os que a própria pessoa fez.
      const pedidos = await tx.$queryRaw<Linha[]>`
        SELECT p.id, p.nota_id, p.perfil_pedinte, u.nome AS pedinte_nome, p.texto, p.estado,
               to_char(p.criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS criado_em,
               -- A-027: o motivo de uma revisão só o professor lê (o Admin lê no histórico da nota);
               -- o motivo de "mantida" aparece a quem fez o pedido e ao professor
               CASE WHEN p.estado = 'mantida' OR (p.estado = 'revisada' AND ${ehProfessor}::boolean)
                    THEN p.motivo_resposta ELSE '' END AS motivo_resposta,
               to_char(p.respondido_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS respondido_em,
               a.nome AS aluno_nome, t.nome AS turma_nome, d.nome AS disciplina_nome,
               n.descricao AS nota_descricao, n.dia::text AS nota_dia,
               vn.valor::float8 AS valor_atual,
               CASE WHEN ${ehProfessor}::boolean THEN vn.numero END AS versao_atual,
               (n.professor_id = ${eu}::uuid) AS pode_responder
          FROM pedido_revisao p
          JOIN nota_oficial n ON n.id = p.nota_id
          JOIN usuario u ON u.id = p.pedido_por
          JOIN usuario a ON a.id = n.aluno_id
          JOIN turma t ON t.id = n.turma_id
          JOIN disciplina d ON d.id = n.disciplina_id
          JOIN LATERAL (SELECT numero, valor FROM nota_oficial_versao vv
                         WHERE vv.instituicao_id = n.instituicao_id AND vv.nota_id = n.id
                         ORDER BY numero DESC LIMIT 1) vn ON true
         WHERE (${ehProfessor}::boolean = false AND p.pedido_por = ${eu}::uuid)
            OR (${ehProfessor}::boolean = true AND EXISTS (
                  SELECT 1 FROM vinculo pv WHERE pv.tipo = 'professor_turma' AND pv.usuario_id = ${eu}::uuid
                     AND pv.turma_id = n.turma_id AND pv.disciplina_id = n.disciplina_id AND pv.desativado_em IS NULL))
         ORDER BY (p.estado <> 'aberto'), p.criado_em DESC
         LIMIT 300`;
      return {
        pedidos: pedidos.map((p) => ({
          ...p,
          pode_responder: ehProfessor && p.pode_responder === true && p.estado === 'aberto',
        })),
      };
    });
  });

  rota(
    'post',
    '/pedidos-revisao/:id/manter',
    podeResponderPedido,
    { params: idParam, corpo: corpoManter },
    async ({ tx, sessao, params, corpo, resposta }) => {
      const [pedido] = await tx.$queryRaw<
        { estado: string; professor_id: string; turma_id: string; disciplina_id: string }[]
      >`SELECT p.estado, n.professor_id, n.turma_id, n.disciplina_id
          FROM pedido_revisao p JOIN nota_oficial n ON n.id = p.nota_id WHERE p.id = ${params.id}::uuid`;
      if (!pedido) return naoAchou(resposta);
      const [vinc] = await tx.$queryRaw<Linha[]>`
        SELECT 1 FROM vinculo WHERE tipo = 'professor_turma' AND usuario_id = ${sessao.usuarioId}::uuid
           AND turma_id = ${pedido.turma_id}::uuid AND disciplina_id = ${pedido.disciplina_id}::uuid
           AND desativado_em IS NULL`;
      if (pedido.professor_id !== sessao.usuarioId || !vinc) {
        return negar(
          tx,
          sessao,
          resposta,
          'pedido_revisao.resposta_negada',
          `pedido_revisao:${params.id}`,
          'Só o professor que lançou a nota responde ao pedido.',
        );
      }
      if (pedido.estado !== 'aberto')
        return resposta.code(409).send({ erro: 'Este pedido já foi respondido.' });
      await tx.$executeRaw`
        UPDATE pedido_revisao SET estado = 'mantida', motivo_resposta = ${corpo.motivo},
               respondido_por = ${sessao.usuarioId}::uuid, respondido_em = now()
         WHERE id = ${params.id}::uuid AND estado = 'aberto'`;
      await auditar(tx, sessao, 'pedido_revisao.respondido', `pedido_revisao:${params.id}`, {
        estado: 'mantida',
        motivo: corpo.motivo,
      });
      return undefined;
    },
  );
}
