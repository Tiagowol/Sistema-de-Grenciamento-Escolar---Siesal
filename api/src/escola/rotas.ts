import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registrarAuditoria } from '../auditoria/auditoria.js';
import type { SessaoAtiva } from '../auth/autenticacao.js';
import { podeAdministrarEscola, podeLerEscola, podeOcultarItemEscolar } from '../auth/politica.js';
import {
  type ClienteTransacao,
  type withTenant as WithTenant,
  withTenant,
} from '../banco/withTenant.js';
import {
  ARREDONDAMENTOS,
  corDaEscolaLegivel,
  LOGOTIPO_MAXIMO,
  type Periodo,
  periodosValidos,
  type Regra,
  tipoDoLogotipo,
} from './regra.js';

// Admin institucional (L19): calendário da escola, regras de notas versionadas e identidade visual.
// Nada se apaga: item do calendário é desativado; regra e identidade só ganham versões novas.
type Banco = Parameters<typeof WithTenant>[0];
type Exigir = (req: FastifyRequest, res: FastifyReply) => Promise<SessaoAtiva | null>;
type Opcoes = { banco: Banco; exigirSessao: Exigir };
type Linha = Record<string, unknown>;

const uuid = z.uuid();
const dia = z.iso.date();
const idParam = z.strictObject({ id: uuid });
const semLink = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((t) => !/(https?:|www\.|:\/\/)/i.test(t), 'Não use links.');
const MAXIMO_DIAS_CONSULTA = 400;

const corpoItem = z
  .strictObject({
    tipo: z.enum(['periodo_letivo', 'feriado', 'evento']),
    titulo: semLink(120),
    dia_inicio: dia,
    dia_fim: dia,
    turma_id: uuid.nullable(),
  })
  .refine((c) => c.dia_fim >= c.dia_inicio, 'fim antes do início')
  .refine(
    (c) => (Date.parse(c.dia_fim) - Date.parse(c.dia_inicio)) / 86_400_000 <= 400,
    'longo demais',
  );
const corpoRegra = z
  .strictObject({
    vigente_desde: dia,
    arredondamento: z.enum(ARREDONDAMENTOS),
    periodos: z
      .array(
        z.strictObject({
          nome: semLink(40),
          inicio: dia,
          fim: dia,
          peso: z.number().int().min(1).max(10),
        }),
      )
      .min(1)
      .max(8),
  })
  .refine((c) => periodosValidos(c.periodos), 'períodos fora de ordem');
const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((c) => c.toLowerCase());
const corpoIdentidade = z.strictObject({
  nome_exibicao: semLink(80),
  cor_claro: hex.nullable(),
  cor_escuro: hex.nullable(),
  // "manter" = mesmo logotipo da versão anterior; null = sem logotipo; objeto = logotipo novo
  logotipo: z.union([
    z.literal('manter'),
    z.null(),
    z.strictObject({
      tipo: z.enum(['image/png', 'image/jpeg']),
      dados: z.base64().max(Math.ceil(LOGOTIPO_MAXIMO / 3) * 4),
    }),
  ]),
});

// Itens do calendário da escola que a pessoa vê: Admin e Pedagógico, todos; os outros, os da escola toda e os
// das turmas do próprio vínculo (aluno na turma, professor da turma, responsável pelo aluno da turma)
export function itensVisiveis(
  tx: ClienteTransacao,
  sessao: Pick<SessaoAtiva, 'perfil' | 'usuarioId'>,
  de: string,
  ate: string,
  soItem: string | null = null,
) {
  const { perfil, usuarioId: eu } = sessao;
  return tx.$queryRaw<Linha[]>`
    SELECT c.id, c.tipo, c.titulo, c.dia_inicio::text AS dia_inicio, c.dia_fim::text AS dia_fim,
           c.turma_id, t.nome AS turma_nome
      FROM calendario_escolar c LEFT JOIN turma t ON t.id = c.turma_id
     WHERE c.desativado_em IS NULL
       AND c.dia_inicio <= ${ate}::date AND c.dia_fim >= ${de}::date
       AND (${soItem}::uuid IS NULL OR c.id = ${soItem}::uuid)
       AND (
             c.turma_id IS NULL
          OR ${perfil} IN ('admin', 'pedagogico')
          OR (${perfil} = 'aluno' AND EXISTS (
                SELECT 1 FROM vinculo v WHERE v.tipo = 'aluno_turma' AND v.usuario_id = ${eu}::uuid
                   AND v.turma_id = c.turma_id AND v.desativado_em IS NULL))
          OR (${perfil} = 'professor' AND EXISTS (
                SELECT 1 FROM vinculo v WHERE v.tipo = 'professor_turma' AND v.usuario_id = ${eu}::uuid
                   AND v.turma_id = c.turma_id AND v.desativado_em IS NULL))
          OR (${perfil} = 'responsavel' AND EXISTS (
                SELECT 1 FROM vinculo r JOIN vinculo a ON a.tipo = 'aluno_turma' AND a.usuario_id = r.aluno_id
                         AND a.desativado_em IS NULL
                 WHERE r.tipo = 'responsavel_aluno' AND r.usuario_id = ${eu}::uuid AND r.desativado_em IS NULL
                   AND a.turma_id = c.turma_id))
           )
     ORDER BY c.dia_inicio, c.titulo
     LIMIT 500`;
}

const somarUmDia = (d: string) => new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10);
const TIPO_NO_CALENDARIO: Record<string, string> = {
  periodo_letivo: 'periodo_letivo',
  feriado: 'feriado',
  evento: 'evento_escolar',
};

// Entradas da escola no Calendário e na Agenda do aluno, no formato de evento (origem calendario_escolar).
// Período letivo aparece no dia do começo e no dia do fim; feriado e evento, em cada dia.
export async function entradasEscolaresDoAluno(
  tx: ClienteTransacao,
  usuarioId: string,
  de: string,
  ate: string,
): Promise<Linha[]> {
  const itens = await itensVisiveis(tx, { perfil: 'aluno', usuarioId }, de, ate);
  const ocultos = new Set(
    (
      await tx.$queryRaw<{ item_id: string }[]>`
        SELECT item_id FROM calendario_escolar_oculto WHERE usuario_id = ${usuarioId}::uuid`
    ).map((o) => o.item_id),
  );
  const saida: Linha[] = [];
  for (const i of itens) {
    if (ocultos.has(i.id as string)) continue;
    const base = {
      item_id: i.id,
      tipo: TIPO_NO_CALENDARIO[i.tipo as string],
      origem: 'calendario_escolar',
      id_externo: null,
      tipo_atividade_id: null,
      hora_inicio: null,
      minutos: null,
      turma_nome: i.turma_nome ?? null,
    };
    const inicio = i.dia_inicio as string;
    const fim = i.dia_fim as string;
    const entrada = (d: string, titulo: string) => {
      if (d >= de && d <= ate) saida.push({ ...base, id: `escola-${i.id}-${d}`, titulo, dia: d });
    };
    if (i.tipo === 'periodo_letivo') {
      if (inicio === fim) entrada(inicio, i.titulo as string);
      else {
        entrada(inicio, `Começa: ${i.titulo}`);
        entrada(fim, `Termina: ${i.titulo}`);
      }
    } else
      for (let d = inicio < de ? de : inicio; d <= fim && d <= ate; d = somarUmDia(d))
        entrada(d, i.titulo as string);
  }
  return saida;
}

// Regra de notas vigente num dia: a versão mais nova entre as que já valiam naquele dia
export async function regraVigente(
  tx: ClienteTransacao,
  diaRef: string | null = null,
): Promise<(Regra & { vigente_desde: string }) | null> {
  const [r] = await tx.$queryRaw<Linha[]>`
    SELECT numero, vigente_desde::text AS vigente_desde, arredondamento, periodos
      FROM regra_nota_versao
     WHERE vigente_desde <= coalesce(${diaRef}::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date)
     ORDER BY numero DESC LIMIT 1`;
  return r
    ? {
        numero: r.numero as number,
        vigente_desde: r.vigente_desde as string,
        arredondamento: r.arredondamento as Regra['arredondamento'],
        periodos: r.periodos as Periodo[],
      }
    : null;
}

export function registrarEscola(app: FastifyInstance, opcoes: Opcoes): void {
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
  function rota<
    P extends z.ZodType = z.ZodUndefined,
    B extends z.ZodType = z.ZodUndefined,
    Q extends z.ZodType = z.ZodUndefined,
  >(
    metodo: 'get' | 'post',
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
          auditar(tx, sessao, 'escola.acesso_negado', `${metodo.toUpperCase()} ${caminho}`, {
            perfil: sessao.perfil,
          }),
        );
        return res.code(403).send({ erro: 'Sem permissão.' });
      }
      const ler = (esquema: z.ZodType | undefined, valor: unknown) =>
        esquema ? esquema.safeParse(valor) : ({ success: true, data: undefined } as const);
      const params = ler(esquemas.params, req.params);
      const corpo = ler(esquemas.corpo, req.body ?? {});
      const consulta = ler(esquemas.consulta, req.query);
      if (!params.success || !corpo.success || !consulta.success) {
        const links = [params, corpo, consulta].some(
          (r) => !r.success && r.error.issues.some((i) => i.message === 'Não use links.'),
        );
        return res
          .code(400)
          .send({ erro: links ? 'O texto não pode ter links.' : 'Dados inválidos.' });
      }
      const saida = await withTenant(opcoes.banco, { instituicaoId: sessao.instituicaoId }, (tx) =>
        funcao({
          tx,
          sessao,
          params: params.data as never,
          corpo: corpo.data as never,
          consulta: consulta.data as never,
          resposta: res,
        }),
      );
      if (res.sent) return res;
      return saida === undefined ? res.code(204).send() : saida;
    });
  }
  const naoAchou = (r: FastifyReply) => r.code(404).send({ erro: 'Não encontrado.' });

  // ---------- 1. Calendário da escola ----------
  const turmaValida = async (tx: ClienteTransacao, turmaId: string | null) =>
    !turmaId ||
    (
      await tx.$queryRaw<Linha[]>`
        SELECT 1 AS x FROM turma WHERE id = ${turmaId}::uuid AND desativado_em IS NULL`
    ).length > 0;
  const gravarVersaoItem = async (
    tx: ClienteTransacao,
    sessao: SessaoAtiva,
    itemId: string,
    acao: 'criado' | 'editado' | 'desativado',
  ) => {
    await tx.$executeRaw`
      INSERT INTO calendario_escolar_versao
             (instituicao_id, item_id, versao, acao, tipo, titulo, dia_inicio, dia_fim, turma_id, autor_id)
      SELECT c.instituicao_id, c.id,
             coalesce((SELECT max(versao) FROM calendario_escolar_versao v WHERE v.item_id = c.id), 0) + 1,
             ${acao}, c.tipo, c.titulo, c.dia_inicio, c.dia_fim, c.turma_id, ${sessao.usuarioId}::uuid
        FROM calendario_escolar c WHERE c.id = ${itemId}::uuid`;
    await auditar(tx, sessao, `calendario_escolar.${acao}`, `calendario_escolar:${itemId}`);
  };

  rota(
    'get',
    '/escola/calendario',
    podeLerEscola,
    { consulta: z.strictObject({ de: dia, ate: dia }) },
    async ({ tx, sessao, consulta, resposta }) => {
      const dias = (Date.parse(consulta.ate) - Date.parse(consulta.de)) / 86_400_000;
      if (dias < 0 || dias > MAXIMO_DIAS_CONSULTA)
        return resposta.code(400).send({ erro: 'Dados inválidos.' });
      return { itens: await itensVisiveis(tx, sessao, consulta.de, consulta.ate) };
    },
  );

  rota(
    'post',
    '/escola/calendario',
    podeAdministrarEscola,
    { corpo: corpoItem },
    async ({ tx, sessao, corpo, resposta }) => {
      if (!(await turmaValida(tx, corpo.turma_id)))
        return resposta.code(400).send({ erro: 'Turma não encontrada.' });
      const [novo] = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO calendario_escolar (instituicao_id, tipo, titulo, dia_inicio, dia_fim, turma_id, criado_por)
        VALUES (${sessao.instituicaoId}::uuid, ${corpo.tipo}, ${corpo.titulo}, ${corpo.dia_inicio}::date,
                ${corpo.dia_fim}::date, ${corpo.turma_id}::uuid, ${sessao.usuarioId}::uuid)
        RETURNING id`;
      if (!novo) throw new Error('Falha ao criar o item.');
      await gravarVersaoItem(tx, sessao, novo.id, 'criado');
      resposta.code(201);
      return { id: novo.id };
    },
  );

  rota(
    'post',
    '/escola/calendario/:id',
    podeAdministrarEscola,
    { params: idParam, corpo: corpoItem },
    async ({ tx, sessao, params, corpo, resposta }) => {
      if (!(await turmaValida(tx, corpo.turma_id)))
        return resposta.code(400).send({ erro: 'Turma não encontrada.' });
      const n = await tx.$executeRaw`
        UPDATE calendario_escolar SET tipo = ${corpo.tipo}, titulo = ${corpo.titulo},
               dia_inicio = ${corpo.dia_inicio}::date, dia_fim = ${corpo.dia_fim}::date,
               turma_id = ${corpo.turma_id}::uuid, atualizado_em = now()
         WHERE id = ${params.id}::uuid AND desativado_em IS NULL`;
      if (n === 0) return naoAchou(resposta);
      await gravarVersaoItem(tx, sessao, params.id, 'editado');
      return undefined;
    },
  );

  rota(
    'post',
    '/escola/calendario/:id/desativar',
    podeAdministrarEscola,
    { params: idParam },
    async ({ tx, sessao, params, resposta }) => {
      const n = await tx.$executeRaw`
        UPDATE calendario_escolar SET desativado_em = now(), atualizado_em = now()
         WHERE id = ${params.id}::uuid AND desativado_em IS NULL`;
      if (n === 0) return naoAchou(resposta);
      await gravarVersaoItem(tx, sessao, params.id, 'desativado');
      return undefined;
    },
  );

  rota(
    'get',
    '/escola/calendario/:id/versoes',
    podeAdministrarEscola,
    { params: idParam },
    async ({ tx, params }) => ({
      versoes: await tx.$queryRaw<Linha[]>`
        SELECT v.versao, v.acao, v.tipo, v.titulo, v.dia_inicio::text AS dia_inicio, v.dia_fim::text AS dia_fim,
               v.turma_id, u.nome AS autor_nome,
               to_char(v.criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia
          FROM calendario_escolar_versao v JOIN usuario u ON u.id = v.autor_id
         WHERE v.item_id = ${params.id}::uuid ORDER BY v.versao DESC`,
    }),
  );

  // O aluno oculta para si um item que ele vê (o item continua para os outros)
  rota(
    'post',
    '/escola/calendario/:id/ocultar',
    podeOcultarItemEscolar,
    { params: idParam },
    async ({ tx, sessao, params, resposta }) => {
      const [item] = await itensVisiveis(tx, sessao, '0001-01-01', '9999-12-31', params.id);
      if (!item) return naoAchou(resposta);
      await tx.$executeRaw`
        INSERT INTO calendario_escolar_oculto (instituicao_id, item_id, usuario_id)
        VALUES (${sessao.instituicaoId}::uuid, ${params.id}::uuid, ${sessao.usuarioId}::uuid)
        ON CONFLICT DO NOTHING`;
      await auditar(tx, sessao, 'calendario_escolar.ocultado', `calendario_escolar:${params.id}`);
      return undefined;
    },
  );

  // ---------- 2. Regras de notas ----------
  rota('get', '/escola/regras-notas', podeLerEscola, {}, async ({ tx, sessao }) => ({
    vigente: await regraVigente(tx),
    // O histórico completo é só do Admin; os outros veem a regra que vale hoje
    versoes: podeAdministrarEscola(sessao.perfil)
      ? await tx.$queryRaw<Linha[]>`
          SELECT r.numero, r.vigente_desde::text AS vigente_desde, r.arredondamento, r.periodos,
                 u.nome AS autor_nome, to_char(r.criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS criada_em
            FROM regra_nota_versao r JOIN usuario u ON u.id = r.autor_id
           ORDER BY r.numero DESC`
      : [],
  }));

  rota(
    'post',
    '/escola/regras-notas',
    podeAdministrarEscola,
    { corpo: corpoRegra },
    async ({ tx, sessao, corpo, resposta }) => {
      // Duas versões ao mesmo tempo não pegam o mesmo número
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`regra:${sessao.instituicaoId}`}, 1))`;
      const [r] = await tx.$queryRaw<{ numero: number }[]>`
        INSERT INTO regra_nota_versao (instituicao_id, numero, vigente_desde, arredondamento, periodos, autor_id)
        VALUES (${sessao.instituicaoId}::uuid,
                coalesce((SELECT max(numero) FROM regra_nota_versao), 0) + 1,
                ${corpo.vigente_desde}::date, ${corpo.arredondamento}, ${JSON.stringify(corpo.periodos)}::jsonb,
                ${sessao.usuarioId}::uuid)
        RETURNING numero`;
      if (!r) throw new Error('Falha ao gravar a regra.');
      await auditar(tx, sessao, 'regra_nota.versao_criada', `regra_nota:${r.numero}`, corpo);
      resposta.code(201);
      return { numero: r.numero };
    },
  );

  // ---------- 3. Identidade visual ----------
  const identidadeAtual = async (tx: ClienteTransacao) => {
    const [i] = await tx.$queryRaw<Linha[]>`
      SELECT numero, nome_exibicao, cor_claro, cor_escuro, (logotipo IS NOT NULL) AS tem_logotipo
        FROM identidade_instituicao_versao ORDER BY numero DESC LIMIT 1`;
    return i ?? null;
  };

  rota('get', '/escola/identidade', podeLerEscola, {}, async ({ tx, sessao }) => ({
    identidade: await identidadeAtual(tx),
    versoes: podeAdministrarEscola(sessao.perfil)
      ? await tx.$queryRaw<Linha[]>`
          SELECT i.numero, i.nome_exibicao, i.cor_claro, i.cor_escuro, (i.logotipo IS NOT NULL) AS tem_logotipo,
                 u.nome AS autor_nome, to_char(i.criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS criada_em
            FROM identidade_instituicao_versao i JOIN usuario u ON u.id = i.autor_id
           ORDER BY i.numero DESC`
      : [],
  }));

  // O logotipo é servido pelo próprio site, com o tipo conferido; o navegador não adivinha o tipo
  rota('get', '/escola/identidade/logotipo', podeLerEscola, {}, async ({ tx, resposta }) => {
    const [l] = await tx.$queryRaw<{ logotipo: Uint8Array | null; logotipo_tipo: string | null }[]>`
        SELECT logotipo, logotipo_tipo FROM identidade_instituicao_versao ORDER BY numero DESC LIMIT 1`;
    if (!l?.logotipo || !l.logotipo_tipo) return naoAchou(resposta);
    return resposta
      .header('content-type', l.logotipo_tipo)
      .header('x-content-type-options', 'nosniff')
      .header('content-disposition', 'inline')
      .send(Buffer.from(l.logotipo));
  });

  rota(
    'post',
    '/escola/identidade',
    podeAdministrarEscola,
    { corpo: corpoIdentidade },
    async ({ tx, sessao, corpo, resposta }) => {
      if (corpo.cor_claro && !corDaEscolaLegivel(corpo.cor_claro, 'claro'))
        return resposta.code(422).send({
          erro: 'A cor para o tema claro tem pouco contraste. Escolha uma cor mais escura.',
        });
      if (corpo.cor_escuro && !corDaEscolaLegivel(corpo.cor_escuro, 'escuro'))
        return resposta.code(422).send({
          erro: 'A cor para o tema escuro tem pouco contraste. Escolha uma cor mais clara.',
        });
      let bytes: Buffer | null = null;
      let tipo: string | null = null;
      if (corpo.logotipo && corpo.logotipo !== 'manter') {
        bytes = Buffer.from(corpo.logotipo.dados, 'base64');
        if (bytes.length === 0 || bytes.length > LOGOTIPO_MAXIMO)
          return resposta.code(422).send({ erro: 'O logotipo precisa ter até 200 KB.' });
        if (tipoDoLogotipo(bytes) !== corpo.logotipo.tipo)
          return resposta
            .code(422)
            .send({ erro: 'O logotipo precisa ser uma imagem PNG ou JPEG.' });
        tipo = corpo.logotipo.tipo;
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`identidade:${sessao.instituicaoId}`}, 1))`;
      const manter = corpo.logotipo === 'manter';
      const [r] = await tx.$queryRaw<{ numero: number }[]>`
        INSERT INTO identidade_instituicao_versao
               (instituicao_id, numero, nome_exibicao, cor_claro, cor_escuro, logotipo, logotipo_tipo, autor_id)
        SELECT ${sessao.instituicaoId}::uuid, coalesce(max(a.numero), 0) + 1, ${corpo.nome_exibicao},
               ${corpo.cor_claro}::text, ${corpo.cor_escuro}::text,
               CASE WHEN ${manter}::boolean THEN (SELECT logotipo FROM identidade_instituicao_versao ORDER BY numero DESC LIMIT 1)
                    ELSE ${bytes}::bytea END,
               CASE WHEN ${manter}::boolean THEN (SELECT logotipo_tipo FROM identidade_instituicao_versao ORDER BY numero DESC LIMIT 1)
                    ELSE ${tipo}::text END,
               ${sessao.usuarioId}::uuid
          FROM identidade_instituicao_versao a
        RETURNING numero`;
      if (!r) throw new Error('Falha ao gravar a identidade.');
      await auditar(tx, sessao, 'identidade.versao_criada', `identidade:${r.numero}`, {
        nome_exibicao: corpo.nome_exibicao,
        cor_claro: corpo.cor_claro,
        cor_escuro: corpo.cor_escuro,
        logotipo: manter ? 'mantido' : bytes ? `${tipo}, ${bytes.length} bytes` : 'sem logotipo',
      });
      resposta.code(201);
      return { identidade: await identidadeAtual(tx) };
    },
  );
}
