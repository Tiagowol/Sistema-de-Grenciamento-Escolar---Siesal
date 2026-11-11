import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registrarAuditoria } from '../auditoria/auditoria.js';
import type { SessaoAtiva } from '../auth/autenticacao.js';
import { podeUsarNucleo } from '../auth/politica.js';
import {
  type ClienteTransacao,
  type withTenant as WithTenant,
  withTenant,
} from '../banco/withTenant.js';
import { entradasEscolaresDoAluno } from '../escola/rotas.js';
import { hojeBrasilia, somarDias } from './datas.js';
import { combinacaoLegivel, ICONES_DE_TIPO, IDS_DE_COR, TEMAS } from './paleta.js';
import { planoRegressivo } from './plano.js';

type Banco = Parameters<typeof WithTenant>[0];
type Exigir = (req: FastifyRequest, res: FastifyReply) => Promise<SessaoAtiva | null>;
type Opcoes = { banco: Banco; exigirSessao: Exigir; agora?: () => Date };

const uuid = z.uuid();
const dia = z.iso.date();
const texto = (max: number) => z.string().trim().min(1).max(max);
const corpoTarefa = z.strictObject({
  titulo: texto(120),
  descricao: z.string().max(2000).optional(),
  disciplina: z.string().trim().max(80).optional(),
  tipo: z.enum(['tarefa', 'trabalho', 'prova', 'leitura']).optional(),
  prazo: dia.nullable().optional(),
  prioridade: z.enum(['baixa', 'media', 'alta']).optional(),
  situacao: z.enum(['pendente', 'em_andamento', 'concluida']).optional(),
  tipo_atividade_id: z.uuid().nullable().optional(),
});

type Linha = Record<string, unknown>;

export function registrarNucleo(app: FastifyInstance, opcoes: Opcoes): void {
  const relogio = opcoes.agora ?? (() => new Date());

  // Envolve cada rota: sessão completa de aluno + transação da instituição. Erro de validação vira 400.
  function rota<
    P extends z.ZodType = z.ZodUndefined,
    B extends z.ZodType = z.ZodUndefined,
    Q extends z.ZodType = z.ZodUndefined,
  >(
    metodo: 'get' | 'post' | 'put' | 'patch' | 'delete',
    caminho: string,
    esquemas: { params?: P; corpo?: B; consulta?: Q },
    funcao: (c: {
      tx: ClienteTransacao;
      sessao: SessaoAtiva;
      params: z.infer<P>;
      corpo: z.infer<B>;
      consulta: z.infer<Q>;
      hoje: string;
      resposta: FastifyReply;
    }) => Promise<unknown>,
  ): void {
    app[metodo](caminho, async (req, res) => {
      const sessao = await opcoes.exigirSessao(req, res);
      if (!sessao) return res;
      if (sessao.nivel !== 'completo' || !podeUsarNucleo(sessao.perfil)) {
        return res.code(403).send({ erro: 'Este recurso é do aluno.' });
      }
      // Só valida o que a rota declarou; o resto fica indefinido
      const ler = (esquema: z.ZodType | undefined, valor: unknown) =>
        esquema ? esquema.safeParse(valor) : ({ success: true, data: undefined } as const);
      const params = ler(esquemas.params, req.params);
      const corpo = ler(esquemas.corpo, req.body);
      const consulta = ler(esquemas.consulta, req.query);
      if (!params.success || !corpo.success || !consulta.success) {
        return res.code(400).send({ erro: 'Dados inválidos.' });
      }
      const hoje = hojeBrasilia(relogio());
      const saida = await withTenant(opcoes.banco, { instituicaoId: sessao.instituicaoId }, (tx) =>
        funcao({
          tx,
          sessao,
          params: params.data as never,
          corpo: corpo.data as never,
          consulta: consulta.data as never,
          hoje,
          resposta: res,
        }),
      );
      if (res.sent) return res;
      return saida === undefined ? res.code(204).send() : saida;
    });
  }
  const idParam = z.strictObject({ id: uuid });
  const naoAchou = (c: { resposta: FastifyReply }) =>
    c.resposta.code(404).send({ erro: 'Não encontrado.' });

  // O tipo de atividade precisa ser do próprio aluno e estar ativo (null = sem tipo)
  const tipoDoAluno = async (tx: ClienteTransacao, usuarioId: string, id?: string | null) => {
    if (!id) return true;
    const [t] = await tx.$queryRaw<Linha[]>`
      SELECT id FROM tipo_atividade WHERE id = ${id}::uuid AND usuario_id = ${usuarioId}::uuid AND desativado_em IS NULL`;
    return Boolean(t);
  };

  // ---------- Tarefas e microetapas (L6) ----------
  const listarTarefas = async (tx: ClienteTransacao, usuarioId: string, soId?: string) => {
    const tarefas = await tx.$queryRaw<Linha[]>`
      SELECT id, titulo, descricao, disciplina, tipo, tipo_atividade_id, prazo::text AS prazo, prioridade, situacao
        FROM tarefa
       WHERE usuario_id = ${usuarioId}::uuid AND desativado_em IS NULL
         AND (${soId ?? null}::uuid IS NULL OR id = ${soId ?? null}::uuid)
       ORDER BY (situacao = 'concluida'), prazo NULLS LAST, criado_em`;
    const ids = tarefas.map((t) => t.id as string);
    const etapas = ids.length
      ? await tx.$queryRaw<Linha[]>`
          SELECT id, tarefa_id, texto, feita, ordem FROM microetapa
           WHERE usuario_id = ${usuarioId}::uuid AND desativado_em IS NULL AND tarefa_id = ANY(${ids}::uuid[])
           ORDER BY ordem, criado_em`
      : [];
    return tarefas.map((t) => ({ ...t, microetapas: etapas.filter((e) => e.tarefa_id === t.id) }));
  };

  rota('get', '/tarefas', {}, async ({ tx, sessao }) => ({
    tarefas: await listarTarefas(tx, sessao.usuarioId),
  }));

  rota(
    'post',
    '/tarefas',
    { corpo: corpoTarefa.extend({ microetapas: z.array(texto(200)).max(20).optional() }) },
    async ({ tx, sessao, corpo, resposta }) => {
      if (!(await tipoDoAluno(tx, sessao.usuarioId, corpo.tipo_atividade_id)))
        return resposta.code(400).send({ erro: 'Tipo de atividade não encontrado.' });
      const [nova] = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO tarefa (instituicao_id, usuario_id, titulo, descricao, disciplina, tipo, prazo, prioridade, situacao, tipo_atividade_id)
        VALUES (${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, ${corpo.titulo}, ${corpo.descricao ?? ''},
                ${corpo.disciplina ?? ''}, ${corpo.tipo ?? 'tarefa'}, ${corpo.prazo ?? null}::date,
                ${corpo.prioridade ?? 'media'}, ${corpo.situacao ?? 'pendente'}, ${corpo.tipo_atividade_id ?? null}::uuid)
        RETURNING id`;
      if (!nova) throw new Error('Falha ao criar tarefa.');
      let ordem = 0;
      for (const t of corpo.microetapas ?? []) {
        await tx.$executeRaw`
          INSERT INTO microetapa (instituicao_id, tarefa_id, usuario_id, texto, ordem)
          VALUES (${sessao.instituicaoId}::uuid, ${nova.id}::uuid, ${sessao.usuarioId}::uuid, ${t}, ${ordem++})`;
      }
      await registrarAuditoria(tx, {
        instituicaoId: sessao.instituicaoId,
        ator: `usuario:${sessao.usuarioId}`,
        acao: 'tarefa.criada',
        alvo: `tarefa:${nova.id}`,
      });
      const [tarefa] = await listarTarefas(tx, sessao.usuarioId, nova.id);
      return resposta.code(201).send({ tarefa });
    },
  );

  rota('patch', '/tarefas/:id', { params: idParam, corpo: corpoTarefa.partial() }, async (c) => {
    const { tx, sessao, params, corpo } = c;
    const [antes] = await tx.$queryRaw<{ situacao: string }[]>`
      SELECT situacao FROM tarefa WHERE id = ${params.id}::uuid AND usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL`;
    if (!antes) return naoAchou(c);
    if (!(await tipoDoAluno(tx, sessao.usuarioId, corpo.tipo_atividade_id)))
      return c.resposta.code(400).send({ erro: 'Tipo de atividade não encontrado.' });
    // Campos ausentes mantêm o valor atual; prazo nulo apaga o prazo
    const temPrazo = corpo.prazo !== undefined;
    await tx.$executeRaw`
      UPDATE tarefa SET
        titulo = coalesce(${corpo.titulo ?? null}::text, titulo),
        descricao = coalesce(${corpo.descricao ?? null}::text, descricao),
        disciplina = coalesce(${corpo.disciplina ?? null}::text, disciplina),
        tipo = coalesce(${corpo.tipo ?? null}::text, tipo),
        prioridade = coalesce(${corpo.prioridade ?? null}::text, prioridade),
        tipo_atividade_id = CASE WHEN ${corpo.tipo_atividade_id !== undefined}::boolean THEN ${corpo.tipo_atividade_id ?? null}::uuid ELSE tipo_atividade_id END,
        prazo = CASE WHEN ${temPrazo}::boolean THEN ${corpo.prazo ?? null}::date ELSE prazo END,
        situacao = coalesce(${corpo.situacao ?? null}::text, situacao),
        concluida_em = CASE WHEN ${corpo.situacao ?? null}::text = 'concluida' THEN now()
                            WHEN ${corpo.situacao ?? null}::text IS NOT NULL THEN NULL ELSE concluida_em END,
        atualizado_em = now()
      WHERE id = ${params.id}::uuid AND usuario_id = ${sessao.usuarioId}::uuid`;
    if (corpo.situacao === 'concluida' && antes.situacao !== 'concluida') {
      await registrarAuditoria(tx, {
        instituicaoId: sessao.instituicaoId,
        ator: `usuario:${sessao.usuarioId}`,
        acao: 'tarefa.concluida',
        alvo: `tarefa:${params.id}`,
      });
    }
    const [tarefa] = await listarTarefas(tx, sessao.usuarioId, params.id);
    return { tarefa };
  });

  rota('delete', '/tarefas/:id', { params: idParam }, async (c) => {
    const { tx, sessao, params } = c;
    const n = await tx.$executeRaw`
      UPDATE tarefa SET desativado_em = now() WHERE id = ${params.id}::uuid AND usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL`;
    if (n === 0) return naoAchou(c);
    await tx.$executeRaw`UPDATE evento SET desativado_em = now() WHERE tarefa_id = ${params.id}::uuid AND origem = 'plano' AND desativado_em IS NULL`;
    await registrarAuditoria(tx, {
      instituicaoId: sessao.instituicaoId,
      ator: `usuario:${sessao.usuarioId}`,
      acao: 'tarefa.desativada',
      alvo: `tarefa:${params.id}`,
    });
    return undefined;
  });

  rota(
    'post',
    '/tarefas/:id/microetapas',
    { params: idParam, corpo: z.strictObject({ texto: texto(200) }) },
    async (c) => {
      const { tx, sessao, params, corpo } = c;
      const [t] = await tx.$queryRaw<
        Linha[]
      >`SELECT id FROM tarefa WHERE id = ${params.id}::uuid AND usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL`;
      if (!t) return naoAchou(c);
      await tx.$executeRaw`
      INSERT INTO microetapa (instituicao_id, tarefa_id, usuario_id, texto, ordem)
      VALUES (${sessao.instituicaoId}::uuid, ${params.id}::uuid, ${sessao.usuarioId}::uuid, ${corpo.texto},
              (SELECT coalesce(max(ordem), -1) + 1 FROM microetapa WHERE tarefa_id = ${params.id}::uuid))`;
      const [tarefa] = await listarTarefas(tx, sessao.usuarioId, params.id);
      return c.resposta.code(201).send({ tarefa });
    },
  );

  rota(
    'patch',
    '/microetapas/:id',
    {
      params: idParam,
      corpo: z.strictObject({ feita: z.boolean().optional(), texto: texto(200).optional() }),
    },
    async (c) => {
      const { tx, sessao, params, corpo } = c;
      const [m] = await tx.$queryRaw<{ tarefa_id: string }[]>`
      UPDATE microetapa SET feita = coalesce(${corpo.feita ?? null}::boolean, feita), texto = coalesce(${corpo.texto ?? null}::text, texto)
       WHERE id = ${params.id}::uuid AND usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL
       RETURNING tarefa_id`;
      if (!m) return naoAchou(c);
      const [tarefa] = await listarTarefas(tx, sessao.usuarioId, m.tarefa_id);
      return { tarefa };
    },
  );

  rota('delete', '/microetapas/:id', { params: idParam }, async (c) => {
    const n = await c.tx
      .$executeRaw`UPDATE microetapa SET desativado_em = now() WHERE id = ${c.params.id}::uuid AND usuario_id = ${c.sessao.usuarioId}::uuid AND desativado_em IS NULL`;
    return n === 0 ? naoAchou(c) : undefined;
  });

  // ---------- Plano regressivo (L7) ----------
  rota(
    'post',
    '/tarefas/:id/plano',
    {
      params: idParam,
      corpo: z.strictObject({
        minutos_total: z.number().int().min(5).max(6000),
        minutos_por_sessao: z.number().int().min(5).max(180),
      }),
    },
    async (c) => {
      const { tx, sessao, params, corpo, hoje } = c;
      const [t] = await tx.$queryRaw<{ titulo: string; prazo: string | null }[]>`
        SELECT titulo, prazo::text AS prazo FROM tarefa WHERE id = ${params.id}::uuid AND usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL`;
      if (!t) return naoAchou(c);
      if (!t.prazo)
        return c.resposta
          .code(422)
          .send({ erro: 'Defina um prazo na tarefa para montar o plano.' });
      const blocos = planoRegressivo({
        hoje,
        prazo: t.prazo,
        minutosTotal: corpo.minutos_total,
        minutosPorSessao: corpo.minutos_por_sessao,
      });
      await tx.$executeRaw`UPDATE evento SET desativado_em = now() WHERE tarefa_id = ${params.id}::uuid AND origem = 'plano' AND desativado_em IS NULL`;
      for (const b of blocos) {
        await tx.$executeRaw`
          INSERT INTO evento (instituicao_id, usuario_id, tarefa_id, titulo, tipo, origem, dia, minutos)
          VALUES (${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, ${params.id}::uuid, ${`Estudar: ${t.titulo}`.slice(0, 120)}, 'estudo', 'plano', ${b.dia}::date, ${Math.max(5, b.minutos)})`;
      }
      await registrarAuditoria(tx, {
        instituicaoId: sessao.instituicaoId,
        ator: `usuario:${sessao.usuarioId}`,
        acao: 'plano.gerado',
        alvo: `tarefa:${params.id}`,
        depois: { blocos: blocos.length },
      });
      return { blocos };
    },
  );

  // ---------- Agenda (L8) e Calendário (L17a): a mesma tabela `evento`, duas formas de ver ----------
  const TIPOS_EVENTO = [
    'aula',
    'estudo',
    'pessoal',
    'prova',
    'trabalho',
    'lembrete',
    'compromisso',
  ] as const;
  const horaOpcional = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional();
  const minutosOpcional = z.number().int().min(5).max(600).nullable().optional();
  const corpoEvento = z.strictObject({
    titulo: texto(120),
    tipo: z.enum(TIPOS_EVENTO).optional(),
    dia,
    hora_inicio: horaOpcional,
    minutos: minutosOpcional,
    tipo_atividade_id: z.uuid().nullable().optional(),
  });
  const MAXIMO_DIAS_CONSULTA = 400;

  // Cada criação, edição, ocultação e desativação grava uma versão (append-only) e um registro de auditoria
  const gravarVersao = async (
    tx: ClienteTransacao,
    sessao: SessaoAtiva,
    eventoId: string,
    acao: 'criado' | 'editado' | 'ocultado' | 'desativado',
  ) => {
    await tx.$executeRaw`
      INSERT INTO evento_versao (instituicao_id, evento_id, versao, acao, titulo, tipo, dia, hora_inicio, minutos)
      SELECT e.instituicao_id, e.id,
             coalesce((SELECT max(versao) FROM evento_versao v
                        WHERE v.instituicao_id = e.instituicao_id AND v.evento_id = e.id), 0) + 1,
             ${acao}, e.titulo, e.tipo, e.dia, e.hora_inicio, e.minutos
        FROM evento e WHERE e.id = ${eventoId}::uuid`;
    await registrarAuditoria(tx, {
      instituicaoId: sessao.instituicaoId,
      ator: `usuario:${sessao.usuarioId}`,
      acao: `evento.${acao}`,
      alvo: `evento:${eventoId}`,
    });
  };

  rota(
    'get',
    '/eventos',
    { consulta: z.strictObject({ de: dia, ate: dia }) },
    async ({ tx, sessao, consulta, resposta }) => {
      const dias = (Date.parse(consulta.ate) - Date.parse(consulta.de)) / 86_400_000;
      if (dias < 0 || dias > MAXIMO_DIAS_CONSULTA)
        return resposta.code(400).send({ erro: 'Dados inválidos.' });
      const proprios = await tx.$queryRaw<Linha[]>`
      SELECT id, tarefa_id, titulo, tipo, tipo_atividade_id, origem, id_externo, dia::text AS dia, to_char(hora_inicio, 'HH24:MI') AS hora_inicio, minutos
        FROM evento
       WHERE usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL AND oculto_em IS NULL
         AND dia BETWEEN ${consulta.de}::date AND ${consulta.ate}::date
       ORDER BY dia, hora_inicio NULLS LAST, criado_em`;
      // L19: itens do calendário da escola e da turma do aluno entram juntos, só para leitura (sem cópia)
      const escola = await entradasEscolaresDoAluno(
        tx,
        sessao.usuarioId,
        consulta.de,
        consulta.ate,
      );
      const eventos = [...escola, ...proprios].sort((a, b) =>
        String(a.dia).localeCompare(String(b.dia)),
      );
      return { eventos };
    },
  );

  rota('post', '/eventos', { corpo: corpoEvento }, async ({ tx, sessao, corpo, resposta }) => {
    if (!(await tipoDoAluno(tx, sessao.usuarioId, corpo.tipo_atividade_id)))
      return resposta.code(400).send({ erro: 'Tipo de atividade não encontrado.' });
    const [e] = await tx.$queryRaw<Linha[]>`
        INSERT INTO evento (instituicao_id, usuario_id, titulo, tipo, dia, hora_inicio, minutos, tipo_atividade_id)
        VALUES (${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, ${corpo.titulo}, ${corpo.tipo ?? 'pessoal'}, ${corpo.dia}::date, ${corpo.hora_inicio ?? null}::time, ${corpo.minutos ?? null}, ${corpo.tipo_atividade_id ?? null}::uuid)
        RETURNING id, titulo, tipo, tipo_atividade_id, origem, id_externo, dia::text AS dia, to_char(hora_inicio, 'HH24:MI') AS hora_inicio, minutos`;
    await gravarVersao(tx, sessao, (e as Linha).id as string, 'criado');
    return resposta.code(201).send({ evento: e });
  });

  // Edita só evento do próprio aluno e de origem manual. Evento importado ou do plano não se edita.
  rota('patch', '/eventos/:id', { params: idParam, corpo: corpoEvento }, async (c) => {
    if (!(await tipoDoAluno(c.tx, c.sessao.usuarioId, c.corpo.tipo_atividade_id)))
      return c.resposta.code(400).send({ erro: 'Tipo de atividade não encontrado.' });
    const [e] = await c.tx.$queryRaw<Linha[]>`
        UPDATE evento SET titulo = ${c.corpo.titulo}, tipo = ${c.corpo.tipo ?? 'pessoal'}, dia = ${c.corpo.dia}::date,
               hora_inicio = ${c.corpo.hora_inicio ?? null}::time, minutos = ${c.corpo.minutos ?? null}, tipo_atividade_id = ${c.corpo.tipo_atividade_id ?? null}::uuid, atualizado_em = now()
         WHERE id = ${c.params.id}::uuid AND usuario_id = ${c.sessao.usuarioId}::uuid
           AND desativado_em IS NULL AND oculto_em IS NULL AND origem = 'manual'
        RETURNING id, titulo, tipo, tipo_atividade_id, origem, id_externo, dia::text AS dia, to_char(hora_inicio, 'HH24:MI') AS hora_inicio, minutos`;
    if (!e) return naoAchou(c);
    await gravarVersao(c.tx, c.sessao, c.params.id, 'editado');
    return { evento: e };
  });

  // Oculta evento do aluno (importado ou não): some das telas, mas a linha e as versões ficam
  rota('post', '/eventos/:id/ocultar', { params: idParam }, async (c) => {
    const n = await c.tx
      .$executeRaw`UPDATE evento SET oculto_em = now(), atualizado_em = now() WHERE id = ${c.params.id}::uuid AND usuario_id = ${c.sessao.usuarioId}::uuid AND desativado_em IS NULL AND oculto_em IS NULL`;
    if (n === 0) return naoAchou(c);
    await gravarVersao(c.tx, c.sessao, c.params.id, 'ocultado');
    return undefined;
  });

  // Desativar: só evento manual ou do plano (importado só se oculta)
  rota('delete', '/eventos/:id', { params: idParam }, async (c) => {
    const n = await c.tx
      .$executeRaw`UPDATE evento SET desativado_em = now(), atualizado_em = now() WHERE id = ${c.params.id}::uuid AND usuario_id = ${c.sessao.usuarioId}::uuid AND desativado_em IS NULL AND origem IN ('manual', 'plano')`;
    if (n === 0) return naoAchou(c);
    await gravarVersao(c.tx, c.sessao, c.params.id, 'desativado');
    return undefined;
  });

  // ---------- Personalização e tipos de atividade (L17b) ----------
  const semLink = (max: number) =>
    z
      .string()
      .trim()
      .min(1)
      .max(max)
      .refine((t) => !/(https?:|www\.|:\/\/|@)/i.test(t), 'Não use links nem e-mail.');
  const corpoPreferencias = z.strictObject({
    apelido: semLink(40).nullable(),
    cor_destaque: z.enum(IDS_DE_COR as [string, ...string[]]).nullable(),
    tema: z.enum(TEMAS),
    fonte: z.number().int().min(90).max(150),
    reduzir_movimento: z.boolean(),
    leitura_facilitada: z.boolean(),
    modo_simples: z.boolean(),
    tempo_visual: z.boolean(),
    linguagem_curta: z.boolean(),
    escolha_agora: z.boolean(),
    tela_inicial: z.enum(['meudia', 'agenda', 'calendario']),
  });
  const PADRAO_PREFERENCIAS = {
    apelido: null,
    cor_destaque: null,
    tema: 'claro',
    fonte: 100,
    reduzir_movimento: false,
    leitura_facilitada: false,
    modo_simples: false,
    tempo_visual: true,
    linguagem_curta: false,
    escolha_agora: true,
    tela_inicial: 'meudia',
  } as const;

  const gravarPreferencias = async (
    tx: ClienteTransacao,
    sessao: SessaoAtiva,
    p: z.infer<typeof corpoPreferencias>,
    acao: string,
  ) => {
    const [linha] = await tx.$queryRaw<Linha[]>`
      INSERT INTO preferencia_usuario (instituicao_id, usuario_id, apelido, cor_destaque, tema, fonte, reduzir_movimento,
                                       leitura_facilitada, modo_simples, tempo_visual, linguagem_curta, escolha_agora, tela_inicial)
      VALUES (${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, ${p.apelido}, ${p.cor_destaque}, ${p.tema}, ${p.fonte},
              ${p.reduzir_movimento}, ${p.leitura_facilitada}, ${p.modo_simples}, ${p.tempo_visual}, ${p.linguagem_curta},
              ${p.escolha_agora}, ${p.tela_inicial})
      ON CONFLICT (instituicao_id, usuario_id) DO UPDATE SET
        apelido = EXCLUDED.apelido, cor_destaque = EXCLUDED.cor_destaque, tema = EXCLUDED.tema, fonte = EXCLUDED.fonte,
        reduzir_movimento = EXCLUDED.reduzir_movimento, leitura_facilitada = EXCLUDED.leitura_facilitada,
        modo_simples = EXCLUDED.modo_simples, tempo_visual = EXCLUDED.tempo_visual, linguagem_curta = EXCLUDED.linguagem_curta,
        escolha_agora = EXCLUDED.escolha_agora, tela_inicial = EXCLUDED.tela_inicial, atualizado_em = now()
      RETURNING apelido, cor_destaque, tema, fonte, reduzir_movimento, leitura_facilitada, modo_simples, tempo_visual,
                linguagem_curta, escolha_agora, tela_inicial`;
    await registrarAuditoria(tx, {
      instituicaoId: sessao.instituicaoId,
      ator: `usuario:${sessao.usuarioId}`,
      acao,
      alvo: `usuario:${sessao.usuarioId}`,
    });
    return linha;
  };

  // null = o aluno nunca personalizou: o padrão acessível continua valendo
  rota('get', '/preferencias', {}, async ({ tx, sessao }) => {
    const [p] = await tx.$queryRaw<Linha[]>`
      SELECT apelido, cor_destaque, tema, fonte, reduzir_movimento, leitura_facilitada, modo_simples, tempo_visual,
             linguagem_curta, escolha_agora, tela_inicial
        FROM preferencia_usuario WHERE usuario_id = ${sessao.usuarioId}::uuid`;
    return { preferencias: p ?? null };
  });

  rota(
    'put',
    '/preferencias',
    { corpo: corpoPreferencias },
    async ({ tx, sessao, corpo, resposta }) => {
      // O sistema não deixa gravar cor e tema difíceis de ler (contraste mínimo de 4,5 para 1)
      if (corpo.cor_destaque && !combinacaoLegivel(corpo.cor_destaque, corpo.tema))
        return resposta
          .code(422)
          .send({ erro: 'Essa cor é difícil de ler neste tema. Escolha outra cor.' });
      return { preferencias: await gravarPreferencias(tx, sessao, corpo, 'preferencias.salvas') };
    },
  );

  // "Voltar ao padrão": grava os valores padrão (nada se apaga; a auditoria guarda o histórico)
  rota('post', '/preferencias/padrao', {}, async ({ tx, sessao }) => ({
    preferencias: await gravarPreferencias(
      tx,
      sessao,
      { ...PADRAO_PREFERENCIAS },
      'preferencias.padrao',
    ),
  }));

  const corpoTipo = z.strictObject({
    nome: semLink(40),
    cor: z.enum(IDS_DE_COR as [string, ...string[]]),
    icone: z.enum(ICONES_DE_TIPO),
  });
  rota('get', '/tipos-atividade', {}, async ({ tx, sessao }) => ({
    tipos: await tx.$queryRaw<Linha[]>`
      SELECT id, nome, cor, icone FROM tipo_atividade
       WHERE usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL ORDER BY lower(nome)`,
  }));
  rota(
    'post',
    '/tipos-atividade',
    { corpo: corpoTipo },
    async ({ tx, sessao, corpo, resposta }) => {
      const [repetido] = await tx.$queryRaw<Linha[]>`
      SELECT id FROM tipo_atividade WHERE usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL
         AND lower(nome) = lower(${corpo.nome})`;
      if (repetido) return resposta.code(409).send({ erro: 'Você já tem um tipo com esse nome.' });
      const [total] = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM tipo_atividade WHERE usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL`;
      if ((total?.n ?? 0) >= 30)
        return resposta.code(409).send({ erro: 'Você chegou ao limite de 30 tipos.' });
      const [t] = await tx.$queryRaw<Linha[]>`
      INSERT INTO tipo_atividade (instituicao_id, usuario_id, nome, cor, icone)
      VALUES (${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, ${corpo.nome}, ${corpo.cor}, ${corpo.icone})
      RETURNING id, nome, cor, icone`;
      await registrarAuditoria(tx, {
        instituicaoId: sessao.instituicaoId,
        ator: `usuario:${sessao.usuarioId}`,
        acao: 'tipo_atividade.criado',
        alvo: `tipo_atividade:${(t as Linha).id}`,
      });
      return resposta.code(201).send({ tipo: t });
    },
  );
  // Desativar: tarefas e eventos que já usam o tipo continuam existindo, só ficam sem ele na tela
  rota('delete', '/tipos-atividade/:id', { params: idParam }, async (c) => {
    const n = await c.tx
      .$executeRaw`UPDATE tipo_atividade SET desativado_em = now() WHERE id = ${c.params.id}::uuid AND usuario_id = ${c.sessao.usuarioId}::uuid AND desativado_em IS NULL`;
    if (n === 0) return naoAchou(c);
    await registrarAuditoria(c.tx, {
      instituicaoId: c.sessao.instituicaoId,
      ator: `usuario:${c.sessao.usuarioId}`,
      acao: 'tipo_atividade.desativado',
      alvo: `tipo_atividade:${c.params.id}`,
    });
    return undefined;
  });

  // ---------- Sessões de estudo e modo foco (L7) ----------
  const lerAtual = (tx: ClienteTransacao, usuarioId: string) =>
    tx.$queryRaw<Linha[]>`
      SELECT s.id, s.tarefa_id, t.titulo AS tarefa_titulo, s.minutos_planejados, s.situacao,
             to_char(s.inicio AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS inicio,
             greatest(0, extract(epoch FROM (now() - s.inicio)))::int AS segundos_decorridos
        FROM sessao_estudo s LEFT JOIN tarefa t ON t.instituicao_id = s.instituicao_id AND t.id = s.tarefa_id
       WHERE s.usuario_id = ${usuarioId}::uuid AND s.situacao = 'em_andamento'`;

  rota('get', '/sessoes/atual', {}, async ({ tx, sessao }) => ({
    sessao: (await lerAtual(tx, sessao.usuarioId))[0] ?? null,
  }));

  rota(
    'post',
    '/sessoes',
    {
      corpo: z.strictObject({
        tarefa_id: uuid.nullable().optional(),
        minutos_planejados: z.number().int().min(5).max(180),
      }),
    },
    async ({ tx, sessao, corpo, resposta }) => {
      if ((await lerAtual(tx, sessao.usuarioId)).length)
        return resposta
          .code(409)
          .send({ erro: 'Já existe uma sessão em andamento. Encerre antes de iniciar outra.' });
      if (corpo.tarefa_id) {
        const [t] = await tx.$queryRaw<
          Linha[]
        >`SELECT id FROM tarefa WHERE id = ${corpo.tarefa_id}::uuid AND usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL`;
        if (!t) return resposta.code(404).send({ erro: 'Tarefa não encontrada.' });
      }
      await tx.$executeRaw`
        INSERT INTO sessao_estudo (instituicao_id, usuario_id, tarefa_id, minutos_planejados)
        VALUES (${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, ${corpo.tarefa_id ?? null}::uuid, ${corpo.minutos_planejados})`;
      return resposta.code(201).send({ sessao: (await lerAtual(tx, sessao.usuarioId))[0] });
    },
  );

  rota(
    'post',
    '/sessoes/:id/encerrar',
    { params: idParam, corpo: z.strictObject({ situacao: z.enum(['concluida', 'interrompida']) }) },
    async (c) => {
      const { tx, sessao, params, corpo } = c;
      const [s] = await tx.$queryRaw<{ minutos_reais: number }[]>`
      UPDATE sessao_estudo SET situacao = ${corpo.situacao}, fim = now(),
             minutos_reais = (extract(epoch FROM (now() - inicio)) / 60)::int
       WHERE id = ${params.id}::uuid AND usuario_id = ${sessao.usuarioId}::uuid AND situacao = 'em_andamento'
       RETURNING minutos_reais`;
      return s ? { minutos_reais: s.minutos_reais } : naoAchou(c);
    },
  );

  // ---------- Notas pessoais (L9) ----------
  rota('get', '/notas-pessoais', {}, async ({ tx, sessao }) => {
    const notas = await tx.$queryRaw<Linha[]>`
      SELECT id, disciplina, descricao, valor::float8 AS valor, dia::text AS dia FROM nota_pessoal
       WHERE usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL ORDER BY dia DESC, criado_em DESC`;
    // Média simples por disciplina, só do próprio aluno. Sem ranking e sem comparação.
    const medias = await tx.$queryRaw<Linha[]>`
      SELECT disciplina, round(avg(valor), 1)::float8 AS media, count(*)::int AS quantidade FROM nota_pessoal
       WHERE usuario_id = ${sessao.usuarioId}::uuid AND desativado_em IS NULL GROUP BY disciplina ORDER BY disciplina`;
    return { notas, medias };
  });

  rota(
    'post',
    '/notas-pessoais',
    {
      corpo: z.strictObject({
        disciplina: texto(80),
        descricao: z.string().trim().max(200).optional(),
        valor: z.number().min(0).max(10),
        dia,
      }),
    },
    async ({ tx, sessao, corpo, resposta }) => {
      const [n] = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO nota_pessoal (instituicao_id, usuario_id, disciplina, descricao, valor, dia)
        VALUES (${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, ${corpo.disciplina}, ${corpo.descricao ?? ''}, ${Math.round(corpo.valor * 10) / 10}, ${corpo.dia}::date)
        RETURNING id`;
      await registrarAuditoria(tx, {
        instituicaoId: sessao.instituicaoId,
        ator: `usuario:${sessao.usuarioId}`,
        acao: 'nota_pessoal.criada',
        alvo: `nota_pessoal:${n?.id}`,
      });
      return resposta.code(201).send({ id: n?.id });
    },
  );

  rota('delete', '/notas-pessoais/:id', { params: idParam }, async (c) => {
    const n = await c.tx
      .$executeRaw`UPDATE nota_pessoal SET desativado_em = now() WHERE id = ${c.params.id}::uuid AND usuario_id = ${c.sessao.usuarioId}::uuid AND desativado_em IS NULL`;
    return n === 0 ? naoAchou(c) : undefined;
  });

  // ---------- Notificações e lembretes dentro do sistema (L10) ----------
  // Os lembretes são criados ao consultar (uma vez por motivo e por dia). Push e e-mail ficam para a Parte 2.
  async function gerarLembretes(
    tx: ClienteTransacao,
    inst: string,
    usuario: string,
    hoje: string,
  ): Promise<void> {
    const amanha = somarDias(hoje, 1);
    await tx.$executeRaw`
      INSERT INTO notificacao (instituicao_id, usuario_id, tipo, titulo, chave_unica)
      SELECT ${inst}::uuid, ${usuario}::uuid,
             CASE WHEN prazo = ${hoje}::date THEN 'prazo_hoje' WHEN prazo = ${amanha}::date THEN 'prazo_amanha' ELSE 'atrasada' END,
             CASE WHEN prazo = ${hoje}::date THEN 'Prazo hoje: ' WHEN prazo = ${amanha}::date THEN 'Prazo amanhã: ' ELSE 'Prazo já passou: ' END || titulo,
             CASE WHEN prazo = ${hoje}::date THEN 'prazo_hoje:' WHEN prazo = ${amanha}::date THEN 'prazo_amanha:' ELSE 'atrasada:' END || id::text || ':' || ${hoje}
        FROM tarefa
       WHERE usuario_id = ${usuario}::uuid AND desativado_em IS NULL AND situacao <> 'concluida' AND prazo IS NOT NULL AND prazo <= ${amanha}::date
      ON CONFLICT (instituicao_id, usuario_id, chave_unica) DO NOTHING`;
    await tx.$executeRaw`
      INSERT INTO notificacao (instituicao_id, usuario_id, tipo, titulo, chave_unica)
      SELECT ${inst}::uuid, ${usuario}::uuid, 'evento_hoje', 'Hoje: ' || titulo || coalesce(' às ' || to_char(hora_inicio, 'HH24:MI'), ''), 'evento_hoje:' || id::text
        FROM evento WHERE usuario_id = ${usuario}::uuid AND desativado_em IS NULL AND dia = ${hoje}::date AND origem = 'manual'
      ON CONFLICT (instituicao_id, usuario_id, chave_unica) DO NOTHING`;
  }

  rota('get', '/notificacoes', {}, async ({ tx, sessao, hoje }) => {
    await gerarLembretes(tx, sessao.instituicaoId, sessao.usuarioId, hoje);
    const notificacoes = await tx.$queryRaw<Linha[]>`
      SELECT id, tipo, titulo, (lida_em IS NOT NULL) AS lida,
             to_char(criado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') AS quando
        FROM notificacao WHERE usuario_id = ${sessao.usuarioId}::uuid ORDER BY criado_em DESC, id LIMIT 50`;
    return { notificacoes, nao_lidas: notificacoes.filter((n) => !n.lida).length };
  });

  rota('post', '/notificacoes/lidas', {}, async ({ tx, sessao }) => {
    await tx.$executeRaw`UPDATE notificacao SET lida_em = now() WHERE usuario_id = ${sessao.usuarioId}::uuid AND lida_em IS NULL`;
    return undefined;
  });

  rota('post', '/notificacoes/:id/lida', { params: idParam }, async (c) => {
    const n = await c.tx
      .$executeRaw`UPDATE notificacao SET lida_em = coalesce(lida_em, now()) WHERE id = ${c.params.id}::uuid AND usuario_id = ${c.sessao.usuarioId}::uuid`;
    return n === 0 ? naoAchou(c) : undefined;
  });

  // ---------- Painel "Meu dia" (L6) ----------
  rota('get', '/meu-dia', {}, async ({ tx, sessao, hoje }) => {
    const u = sessao.usuarioId;
    const fim = somarDias(hoje, 7);
    const [tarefas, eventos, minutos, sessaoAtual, progresso] = await Promise.all([
      tx.$queryRaw<Linha[]>`
        SELECT id, titulo, disciplina, prazo::text AS prazo, prioridade, situacao,
               (SELECT count(*)::int FROM microetapa m WHERE m.tarefa_id = t.id AND m.desativado_em IS NULL) AS etapas,
               (SELECT count(*)::int FROM microetapa m WHERE m.tarefa_id = t.id AND m.desativado_em IS NULL AND m.feita) AS etapas_feitas
          FROM tarefa t WHERE usuario_id = ${u}::uuid AND desativado_em IS NULL AND situacao <> 'concluida' AND (prazo IS NULL OR prazo <= ${fim}::date)
         ORDER BY prazo NULLS LAST, CASE prioridade WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END LIMIT 30`,
      tx.$queryRaw<Linha[]>`
        SELECT id, titulo, tipo, origem, tarefa_id, to_char(hora_inicio, 'HH24:MI') AS hora_inicio, minutos FROM evento
         WHERE usuario_id = ${u}::uuid AND desativado_em IS NULL AND dia = ${hoje}::date ORDER BY hora_inicio NULLS LAST, criado_em`,
      tx.$queryRaw<{ total: number }[]>`
        SELECT coalesce(sum(minutos_reais), 0)::int AS total FROM sessao_estudo
         WHERE usuario_id = ${u}::uuid AND situacao <> 'em_andamento' AND (fim AT TIME ZONE 'America/Sao_Paulo')::date = ${hoje}::date`,
      lerAtual(tx, u),
      tx.$queryRaw<{ feitas: number; total: number }[]>`
        SELECT count(*) FILTER (WHERE situacao = 'concluida')::int AS feitas, count(*)::int AS total
          FROM tarefa WHERE usuario_id = ${u}::uuid AND desativado_em IS NULL`,
    ]);
    return {
      hoje,
      atrasadas: tarefas.filter((t) => t.prazo && (t.prazo as string) < hoje),
      para_hoje: tarefas.filter((t) => t.prazo === hoje),
      proximas: tarefas.filter((t) => !t.prazo || (t.prazo as string) > hoje),
      eventos,
      minutos_estudados_hoje: minutos[0]?.total ?? 0,
      sessao_atual: sessaoAtual[0] ?? null,
      tarefas_concluidas: progresso[0]?.feitas ?? 0,
      tarefas_total: progresso[0]?.total ?? 0,
    };
  });
}
