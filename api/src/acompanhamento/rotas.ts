import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registrarAuditoria } from '../auditoria/auditoria.js';
import type { SessaoAtiva } from '../auth/autenticacao.js';
import { hashToken } from '../auth/cadastro-responsavel.js';
import { hashDoCodigo } from '../auth/convite-individual.js';
import type { EnviarEmail } from '../auth/email.js';
import { podeAdministrarAcompanhamento } from '../auth/politica.js';
import {
  type ClienteTransacao,
  type withTenant as WithTenant,
  withTenant,
} from '../banco/withTenant.js';

// L22a-2: "Quem pode ver meus dados" (lado do aluno e do representante legal). Docs: PROPOSTA-L22A-1C-E-L22A-2.md (A-080, A-081).
// O pedido nasce sempre do aluno (ou do representante legal, se o aluno é menor). Ninguém procura aluno; não há busca.
// Padrão de cada pedido: nada marcado. Aluno menor: o vínculo só vale depois que o representante legal aprova.
type Banco = Parameters<typeof WithTenant>[0];
type Exigir = (req: FastifyRequest, res: FastifyReply) => Promise<SessaoAtiva | null>;
type Opcoes = {
  banco: Banco;
  exigirSessao: Exigir;
  limitar?: (req: FastifyRequest, res: FastifyReply) => boolean;
  enviarEmail?: EnviarEmail;
  linkBase?: string;
};

export const LIMITE_ACOMPANHANTES = 5;
const MESES_VALIDADE = 12;
const idParam = z.strictObject({ id: z.uuid() });
const email = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .regex(/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/, 'E-mail inválido.');
const itens = z.strictObject({
  tarefas: z.boolean(),
  dificuldade: z.boolean(),
  notas: z.boolean(),
  mensagens: z.boolean(),
});
const corpoCriar = z.strictObject({
  email,
  papel: z.enum(['professor', 'pedagogico', 'responsavel']),
  itens,
});
const corpoPorCodigo = z.strictObject({ codigo: z.string().trim().min(8).max(64), itens });
const corpoEncerrar = z.strictObject({
  justificativa: z
    .string()
    .trim()
    .min(3)
    .max(300)
    .refine((t) => !/(https?:|www\.|:\/\/|[<>])/i.test(t), 'Não use links.'),
});

// Quem está agindo: o aluno (no próprio espaço) ou o representante legal ligado ao aluno
type Ator = { tipo: 'aluno' | 'representante'; alunoId: string; menor: boolean };
type Linha = {
  id: string;
  papel: string;
  situacao: string;
  email_convidado: string | null;
  origem: 'email' | 'codigo';
  instituicao_nome: string | null;
  ver_tarefas: boolean;
  ver_dificuldade: boolean;
  ver_notas: boolean;
  ver_mensagens: boolean;
  aprovado: boolean;
  aceito: boolean;
  fim_em: string | null;
  dias_restantes: number | null;
  justificativa: string | null;
};

// Aviso de renovação em palavras: faltam 30, 15 ou 1 dia (sem pressão)
export function avisoDeValidade(
  dias: number | null,
): 'trinta' | 'quinze' | 'um' | 'vencido' | null {
  if (dias === null) return null;
  if (dias < 0) return 'vencido';
  if (dias <= 1) return 'um';
  if (dias <= 15) return 'quinze';
  if (dias <= 30) return 'trinta';
  return null;
}

export function registrarAcompanhamento(app: FastifyInstance, opcoes: Opcoes): void {
  const auditar = (
    tx: ClienteTransacao,
    s: SessaoAtiva,
    acao: string,
    alvo: string,
    depois?: Record<string, unknown>,
  ) =>
    registrarAuditoria(tx, {
      instituicaoId: s.instituicaoId,
      ator: `usuario:${s.usuarioId}`,
      acao,
      alvo,
      depois,
    });

  async function contexto(tx: ClienteTransacao, s: SessaoAtiva): Promise<Ator | null> {
    const [i] = await tx.$queryRaw<{ tipo: string }[]>`
      SELECT tipo FROM instituicao WHERE id = ${s.instituicaoId}::uuid`;
    if (i?.tipo !== 'individual') return null; // só no espaço individual do aluno
    let alunoId = s.usuarioId;
    let tipo: Ator['tipo'] = 'aluno';
    if (s.perfil === 'responsavel') {
      const [v] = await tx.$queryRaw<{ aluno_id: string }[]>`
        SELECT aluno_id FROM vinculo
         WHERE tipo = 'responsavel_aluno' AND tipo_responsavel = 'legal' AND desativado_em IS NULL
           AND usuario_id = ${s.usuarioId}::uuid LIMIT 1`;
      if (!v) return null; // representante indicado só vê; não gerencia
      alunoId = v.aluno_id;
      tipo = 'representante';
    }
    const [d] = await tx.$queryRaw<{ menor: boolean }[]>`
      SELECT coalesce((SELECT nascimento > (current_date - interval '18 years')::date
                         FROM aluno_dados WHERE usuario_id = ${alunoId}::uuid), true) AS menor`;
    return { tipo, alunoId, menor: d?.menor ?? true };
  }
  // Aluno menor: aluno e representante legal gerenciam. Aluno maior: só o aluno.
  const podeGerir = (a: Ator) => a.tipo === 'aluno' || a.menor;

  // Entrada comum: sessão completa, perfil permitido, espaço individual. Tudo no mesmo contexto de instituição.
  function rota<B extends z.ZodType = z.ZodUndefined, P extends z.ZodType = z.ZodUndefined>(
    metodo: 'get' | 'post' | 'patch',
    caminho: string,
    esquemas: { params?: P; corpo?: B },
    funcao: (c: {
      tx: ClienteTransacao;
      s: SessaoAtiva;
      a: Ator;
      params: z.infer<P>;
      corpo: z.infer<B>;
    }) => Promise<{ codigo: number; corpo?: unknown; depois?: () => Promise<void> }>,
  ): void {
    app[metodo](caminho, async (req, res) => {
      const s = await opcoes.exigirSessao(req, res);
      if (!s) return res;
      // Tentativas de código limitadas por IP (como as demais rotas de código)
      if (caminho === '/acompanhamento/instituicao' && opcoes.limitar && !opcoes.limitar(req, res))
        return res;
      if (s.nivel !== 'completo' || !podeAdministrarAcompanhamento(s.perfil)) {
        await withTenant(opcoes.banco, { instituicaoId: s.instituicaoId }, (tx) =>
          auditar(tx, s, 'acompanhamento.acesso_negado', `${metodo.toUpperCase()} ${caminho}`),
        );
        return res.code(403).send({ erro: 'Sem permissão.' });
      }
      const ler = (esquema: z.ZodType | undefined, valor: unknown) =>
        esquema ? esquema.safeParse(valor) : ({ success: true, data: undefined } as const);
      const params = ler(esquemas.params, req.params);
      const corpo = ler(esquemas.corpo, req.body ?? {});
      if (!params.success || !corpo.success) {
        const links =
          !corpo.success && corpo.error.issues.some((i) => i.message === 'Não use links.');
        return res.code(400).send({
          erro: links ? 'O texto não pode ter links, e-mail nem HTML.' : 'Dados inválidos.',
        });
      }
      // F-056: a resposta só sai depois do COMMIT
      const r = await withTenant(opcoes.banco, { instituicaoId: s.instituicaoId }, async (tx) => {
        const a = await contexto(tx, s);
        if (!a) return { codigo: 403, corpo: { erro: 'Sem permissão.' } };
        return funcao({ tx, s, a, params: params.data as never, corpo: corpo.data as never });
      });
      await r.depois?.();
      return res.code(r.codigo).send(r.corpo);
    });
  }

  const lerLinhas = (tx: ClienteTransacao, alunoId: string) =>
    tx.$queryRaw<Linha[]>`
      SELECT a.id, a.papel, a.situacao, a.email_convidado, a.origem, a.instituicao_acomp_nome AS instituicao_nome, a.ver_tarefas, a.ver_dificuldade, a.ver_notas, a.ver_mensagens,
             (a.aprovado_em IS NOT NULL) AS aprovado, (a.pessoa_id IS NOT NULL OR a.usuario_acomp_id IS NOT NULL) AS aceito,
             to_char(a.fim_em, 'YYYY-MM-DD') AS fim_em, (a.fim_em - current_date)::int AS dias_restantes, a.justificativa
        FROM acompanhamento a WHERE a.aluno_id = ${alunoId}::uuid
       ORDER BY (a.situacao = 'encerrado'), a.criado_em DESC`;
  const acharAberto = async (tx: ClienteTransacao, alunoId: string, id: string) => {
    const [l] = await tx.$queryRaw<
      {
        id: string;
        papel: string;
        situacao: string;
        origem: string;
        fim_em: string | null;
        aprovado: boolean;
      }[]
    >`
      SELECT id, papel, situacao, origem, to_char(fim_em, 'YYYY-MM-DD') AS fim_em, (aprovado_em IS NOT NULL) AS aprovado
        FROM acompanhamento WHERE id = ${id}::uuid AND aluno_id = ${alunoId}::uuid AND situacao <> 'encerrado'`;
    return l ?? null;
  };
  const naoAchou = { codigo: 404, corpo: { erro: 'Não encontrado.' } };
  const semPermissao = { codigo: 403, corpo: { erro: 'Sem permissão.' } };

  // ---------- Lista: quem pode ver os dados do aluno ----------
  rota('get', '/acompanhamento', {}, async ({ tx, a }) => {
    const lista = (await lerLinhas(tx, a.alunoId)).map((l) => ({
      ...l,
      aviso: avisoDeValidade(l.dias_restantes),
    }));
    return {
      codigo: 200,
      corpo: {
        acompanhantes: lista,
        menor: a.menor,
        ator: a.tipo,
        pode_gerir: podeGerir(a),
        limite: LIMITE_ACOMPANHANTES,
      },
    };
  });

  // ---------- Novo pedido por e-mail ----------
  rota('post', '/acompanhamento', { corpo: corpoCriar }, async ({ tx, s, a, corpo }) => {
    if (!podeGerir(a)) return semPermissao;
    // Representante indicado: só o aluno maior indica
    if (corpo.papel === 'responsavel' && (a.tipo !== 'aluno' || a.menor)) return semPermissao;
    const [n] = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM acompanhamento WHERE aluno_id = ${a.alunoId}::uuid AND situacao <> 'encerrado'`;
    if ((n?.n ?? 0) >= LIMITE_ACOMPANHANTES)
      return {
        codigo: 409,
        corpo: {
          erro: `Você chegou ao limite de ${LIMITE_ACOMPANHANTES} pessoas. Encerre uma para convidar outra.`,
        },
      };
    const [igual] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM acompanhamento
       WHERE aluno_id = ${a.alunoId}::uuid AND situacao <> 'encerrado' AND papel = ${corpo.papel}
         AND lower(btrim(email_convidado)) = lower(${corpo.email}) LIMIT 1`;
    if (igual)
      return {
        codigo: 409,
        corpo: { erro: 'Já existe um pedido aberto para este e-mail e este papel.' },
      };
    // Aprovação do representante: nasce junto se foi ele quem pediu, ou se o aluno é maior
    const aprovado = a.tipo === 'representante' || !a.menor;
    const [novo] = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO acompanhamento (instituicao_id, aluno_id, email_convidado, papel, ver_tarefas, ver_dificuldade, ver_notas,
                                  ver_mensagens, criado_por_usuario_id, aprovado_em)
      VALUES (${s.instituicaoId}::uuid, ${a.alunoId}::uuid, ${corpo.email}, ${corpo.papel}, ${corpo.itens.tarefas},
              ${corpo.itens.dificuldade}, ${corpo.itens.notas}, ${corpo.itens.mensagens}, ${s.usuarioId}::uuid,
              ${aprovado ? new Date() : null})
      RETURNING id`;
    const id = (novo as { id: string }).id;
    const token = randomBytes(32).toString('base64url');
    await tx.$executeRaw`SELECT acompanhamento_convite_gravar(${s.instituicaoId}::uuid, ${id}::uuid, ${corpo.email}, ${hashToken(token)})`;
    await auditar(tx, s, 'acompanhamento.pedido_criado', `acompanhamento:${id}`, {
      papel: corpo.papel,
      itens: corpo.itens,
    });
    return {
      codigo: 201,
      corpo: { id, aguarda_aprovacao: !aprovado },
      // O e-mail sai só depois do COMMIT. Sem o nome do aluno: o link basta.
      depois: async () => {
        if (!opcoes.enviarEmail) return;
        const link = `${(opcoes.linkBase ?? 'http://localhost:18080').replace(/\/+$/, '')}/acompanhar#${token}`;
        try {
          await opcoes.enviarEmail({
            para: corpo.email,
            assunto: 'SIESAL: convite para acompanhar um aluno',
            texto: `Olá.\n\nUm aluno, ou o representante legal dele, pediu que você o acompanhe no SIESAL. Você só vê o que ele liberar, e ele pode encerrar quando quiser.\n\nPara aceitar, entre na sua conta SIESAL (cadastro como ${corpo.papel === 'professor' ? 'professor' : corpo.papel === 'pedagogico' ? 'profissional do Pedagógico' : 'representante legal'}, feito com este e-mail) e abra este link. O link vale uma vez e por 7 dias:\n${link}\n\nSe você não conhece este pedido, ignore esta mensagem.\n`,
          });
        } catch (erro) {
          app.log.error({ err: erro }, 'e-mail do convite de acompanhamento não enviado');
        }
      },
    };
  });

  // ---------- Muda as 4 caixas (o acompanhante vê o aviso de novo) ----------
  rota(
    'patch',
    '/acompanhamento/:id/itens',
    { params: idParam, corpo: itens },
    async ({ tx, s, a, params, corpo }) => {
      if (!podeGerir(a)) return semPermissao;
      const l = await acharAberto(tx, a.alunoId, params.id);
      if (!l) return naoAchou;
      await tx.$executeRaw`
      UPDATE acompanhamento SET ver_tarefas = ${corpo.tarefas}, ver_dificuldade = ${corpo.dificuldade},
             ver_notas = ${corpo.notas}, ver_mensagens = ${corpo.mensagens}, itens_alterados_em = now()
       WHERE id = ${params.id}::uuid AND aluno_id = ${a.alunoId}::uuid`;
      await auditar(tx, s, 'acompanhamento.itens_alterados', `acompanhamento:${params.id}`, {
        itens: corpo,
      });
      return { codigo: 200, corpo: { ok: true } };
    },
  );

  // ---------- O representante legal aprova o pedido do aluno menor ----------
  rota('post', '/acompanhamento/:id/aprovar', { params: idParam }, async ({ tx, s, a, params }) => {
    if (a.tipo !== 'representante') return semPermissao;
    const l = await acharAberto(tx, a.alunoId, params.id);
    if (!l) return naoAchou;
    if (l.aprovado) return { codigo: 200, corpo: { ok: true } };
    // Se a pessoa já aceitou, o vínculo passa a valer agora; se não, a aprovação fica guardada
    await tx.$executeRaw`
      UPDATE acompanhamento SET aprovado_em = now(),
             situacao = CASE WHEN (pessoa_id IS NOT NULL OR usuario_acomp_id IS NOT NULL) THEN 'ativo' ELSE situacao END,
             inicio_em = CASE WHEN (pessoa_id IS NOT NULL OR usuario_acomp_id IS NOT NULL) THEN now() ELSE inicio_em END,
             fim_em = CASE WHEN (pessoa_id IS NOT NULL OR usuario_acomp_id IS NOT NULL) AND papel <> 'responsavel'
                           THEN (CASE WHEN origem = 'codigo' THEN acompanhamento_validade_instituicao(instituicao_acomp_id)
                                      ELSE (current_date + make_interval(months => ${MESES_VALIDADE}::int))::date END)
                           ELSE fim_em END
       WHERE id = ${params.id}::uuid AND aluno_id = ${a.alunoId}::uuid`;
    await auditar(tx, s, 'acompanhamento.aprovado', `acompanhamento:${params.id}`);
    return { codigo: 200, corpo: { ok: true } };
  });

  // ---------- Encerra a qualquer hora, com justificativa registrada ----------
  rota(
    'post',
    '/acompanhamento/:id/encerrar',
    { params: idParam, corpo: corpoEncerrar },
    async ({ tx, s, a, params, corpo }) => {
      if (!podeGerir(a)) return semPermissao;
      const l = await acharAberto(tx, a.alunoId, params.id);
      if (!l) return naoAchou;
      await tx.$executeRaw`
      UPDATE acompanhamento SET situacao = 'encerrado', encerrado_em = now(), encerrado_por = ${a.tipo},
             justificativa = ${corpo.justificativa}
       WHERE id = ${params.id}::uuid AND aluno_id = ${a.alunoId}::uuid`;
      // O link de um pedido encerrado deixa de valer sozinho: a função de aceite só aceita pedido em 'aguardando_aceite'
      await auditar(tx, s, 'acompanhamento.encerrado', `acompanhamento:${params.id}`, {
        por: a.tipo,
      });
      return { codigo: 200, corpo: { ok: true } };
    },
  );

  // ---------- Renova (professor e pedagógico): menor, o representante; maior, o aluno ----------
  rota('post', '/acompanhamento/:id/renovar', { params: idParam }, async ({ tx, s, a, params }) => {
    if (a.menor ? a.tipo !== 'representante' : a.tipo !== 'aluno') return semPermissao;
    const l = await acharAberto(tx, a.alunoId, params.id);
    // Vínculo de instituição não se renova aqui: a instituição renova em lote e o aluno prorroga por 30 dias
    if (!l || l.papel === 'responsavel' || l.situacao !== 'ativo' || l.origem !== 'email')
      return naoAchou;
    await tx.$executeRaw`
      UPDATE acompanhamento
         SET fim_em = (greatest(coalesce(fim_em, current_date), current_date) + make_interval(months => ${MESES_VALIDADE}::int))::date
       WHERE id = ${params.id}::uuid AND aluno_id = ${a.alunoId}::uuid`;
    await auditar(tx, s, 'acompanhamento.renovado', `acompanhamento:${params.id}`);
    return { codigo: 200, corpo: { ok: true } };
  });

  // ---------- Pedido por CÓDIGO DA INSTITUIÇÃO (L22a-2b): o aluno digita; o pedido cai na fila do Pedagógico ----------
  rota(
    'post',
    '/acompanhamento/instituicao',
    { corpo: corpoPorCodigo },
    async ({ tx, s, a, corpo }) => {
      if (!podeGerir(a)) return semPermissao;
      // Código errado, desligado ou de instituição suspensa: a mesma resposta (não revela qual)
      const aprovado = a.tipo === 'representante' || !a.menor;
      const [r] = await tx.$queryRaw<{ r: string }[]>`
        SELECT acompanhamento_codigo_pedir(${s.instituicaoId}::uuid, ${a.alunoId}::uuid, ${s.usuarioId}::uuid,
          ${hashDoCodigo(corpo.codigo)}, ${corpo.itens.tarefas}, ${corpo.itens.dificuldade}, ${corpo.itens.notas},
          ${corpo.itens.mensagens}, ${aprovado}) AS r`;
      if (r?.r === 'duplicado')
        return {
          codigo: 409,
          corpo: { erro: 'Já existe um pedido aberto para esta instituição.' },
        };
      if (r?.r === 'limite')
        return {
          codigo: 409,
          corpo: {
            erro: `Você chegou ao limite de ${LIMITE_ACOMPANHANTES} pessoas. Encerre uma para convidar outra.`,
          },
        };
      if (r?.r !== 'ok')
        return {
          codigo: 400,
          corpo: { erro: 'Não foi possível enviar o pedido. Confira o código.' },
        };
      await auditar(tx, s, 'acompanhamento.pedido_por_codigo', `aluno:${a.alunoId}`, {
        itens: corpo.itens,
      });
      return { codigo: 201, corpo: { enviado: true, aguarda_aprovacao: !aprovado } };
    },
  );

  // ---------- Prorrogação curta (30 dias) de um vínculo de instituição que vence em até 30 dias ou já venceu ----------
  rota(
    'post',
    '/acompanhamento/:id/prorrogar',
    { params: idParam },
    async ({ tx, s, a, params }) => {
      if (!podeGerir(a)) return semPermissao;
      const l = await acharAberto(tx, a.alunoId, params.id);
      if (l?.origem !== 'codigo' || l.situacao !== 'ativo') return naoAchou;
      const n = await tx.$executeRaw`
      UPDATE acompanhamento SET fim_em = (greatest(coalesce(fim_em, current_date), current_date) + 30)::date
       WHERE id = ${params.id}::uuid AND aluno_id = ${a.alunoId}::uuid
         AND (fim_em IS NULL OR fim_em <= current_date + 30)`;
      if (n === 0)
        return {
          codigo: 409,
          corpo: { erro: 'Ainda falta mais de 30 dias para vencer. Prorrogue perto da data.' },
        };
      await auditar(tx, s, 'acompanhamento.prorrogado', `acompanhamento:${params.id}`);
      return { codigo: 200, corpo: { ok: true } };
    },
  );
}
