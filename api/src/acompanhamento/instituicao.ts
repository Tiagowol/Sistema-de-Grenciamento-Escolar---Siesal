import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registrarAuditoria } from '../auditoria/auditoria.js';
import type { SessaoAtiva } from '../auth/autenticacao.js';
import { gerarCodigoDeConvite, hashDoCodigo } from '../auth/convite-individual.js';
import {
  podeAcompanharPorInstituicao,
  podeGerirCodigoAcompanhamento,
  podeGerirVinculosInstituicao,
} from '../auth/politica.js';
import {
  type ClienteTransacao,
  type withTenant as WithTenant,
  withTenant,
} from '../banco/withTenant.js';
import { avisoDeValidade } from './rotas.js';

// L22a-2b: acompanhamento por CÓDIGO DA INSTITUIÇÃO, lado da instituição (docs/PROPOSTA-L22A-2B.md, A-086).
// O Admin liga e gera o código. O pedido nasce do aluno e cai na fila do Pedagógico, que vê só o nome e as caixas pedidas.
// Quem aceita vira o acompanhante e lê pela própria sessão, UM aluno e UM item por vez, só o que foi liberado.
// Admin e Pedagógico encerram (com justificativa) e renovam em lote os vínculos da instituição.
type Banco = Parameters<typeof WithTenant>[0];
type Exigir = (req: FastifyRequest, res: FastifyReply) => Promise<SessaoAtiva | null>;
type Opcoes = { banco: Banco; exigirSessao: Exigir };
type Saida = { codigo: number; corpo?: unknown };

const idParam = z.strictObject({ id: z.uuid() });
const itemParam = z.strictObject({
  id: z.uuid(),
  item: z.enum(['tarefas', 'dificuldade', 'notas', 'mensagens']),
});
const corpoCodigo = z.strictObject({ acao: z.enum(['gerar', 'ligar', 'desligar']) });
const justificativa = z
  .string()
  .trim()
  .min(3)
  .max(300)
  .refine((t) => !/(https?:|www\.|:\/\/|[<>])/i.test(t), 'Não use links.');
const corpoJustificativa = z.strictObject({ justificativa });
const corpoLote = z.strictObject({ ids: z.array(z.uuid()).min(1).max(100) });

type Vinculo = {
  acompanhamento_id: string;
  aluno_nome: string;
  usuario_id: string;
  situacao: string;
  fim_em: Date | string | null;
  dias_restantes: number | null;
  vencido: boolean;
  ver_tarefas: boolean;
  ver_dificuldade: boolean;
  ver_notas: boolean;
  ver_mensagens: boolean;
  aviso_pendente: boolean;
};
const dia = (v: Date | string | null) =>
  v === null ? null : typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10);

export function registrarAcompanhamentoInstituicao(app: FastifyInstance, opcoes: Opcoes): void {
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

  // Deny by default: perfil sem permissão (ou sessão incompleta) é negado e a tentativa é auditada
  function rota<B extends z.ZodType = z.ZodUndefined, P extends z.ZodType = z.ZodUndefined>(
    metodo: 'get' | 'post',
    caminho: string,
    permite: (perfil: string) => boolean,
    esquemas: { params?: P; corpo?: B },
    funcao: (c: {
      tx: ClienteTransacao;
      s: SessaoAtiva;
      params: z.infer<P>;
      corpo: z.infer<B>;
    }) => Promise<Saida>,
  ): void {
    app[metodo](`/acompanhamento-instituicao${caminho}`, async (req, res) => {
      const s = await opcoes.exigirSessao(req, res);
      if (!s) return res;
      if (s.nivel !== 'completo' || !permite(s.perfil)) {
        await withTenant(opcoes.banco, { instituicaoId: s.instituicaoId }, (tx) =>
          auditar(
            tx,
            s,
            'acompanhamento_instituicao.acesso_negado',
            `${metodo.toUpperCase()} ${caminho}`,
          ),
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
      const r = await withTenant(opcoes.banco, { instituicaoId: s.instituicaoId }, (tx) =>
        funcao({ tx, s, params: params.data as never, corpo: corpo.data as never }),
      );
      return res.code(r.codigo).send(r.corpo);
    });
  }
  const naoAchou: Saida = { codigo: 404, corpo: { erro: 'Não encontrado.' } };

  // ---------- Código da instituição (só o Admin) ----------
  rota('get', '/codigo', podeGerirCodigoAcompanhamento, {}, async ({ tx }) => {
    const [c] = await tx.$queryRaw<{ ativo: boolean; tem: boolean }[]>`
      SELECT ativo, (codigo_hash IS NOT NULL) AS tem FROM codigo_acompanhamento LIMIT 1`;
    return { codigo: 200, corpo: { ativo: c?.ativo ?? false, tem_codigo: c?.tem ?? false } };
  });
  rota(
    'post',
    '/codigo',
    podeGerirCodigoAcompanhamento,
    { corpo: corpoCodigo },
    async ({ tx, s, corpo }) => {
      if (corpo.acao === 'gerar') {
        // O código aparece uma vez; o antigo deixa de valer. Só o hash fica guardado.
        const novo = gerarCodigoDeConvite();
        await tx.$executeRaw`
        INSERT INTO codigo_acompanhamento (instituicao_id, codigo_hash, ativo)
        VALUES (${s.instituicaoId}::uuid, ${hashDoCodigo(novo)}, true)
        ON CONFLICT (instituicao_id) DO UPDATE SET codigo_hash = EXCLUDED.codigo_hash, ativo = true, atualizado_em = now()`;
        await auditar(
          tx,
          s,
          'acompanhamento_instituicao.codigo_gerado',
          `instituicao:${s.instituicaoId}`,
        );
        return { codigo: 201, corpo: { codigo: novo, ativo: true } };
      }
      const ligar = corpo.acao === 'ligar';
      const n = await tx.$executeRaw`
      UPDATE codigo_acompanhamento SET ativo = ${ligar}, atualizado_em = now()
       WHERE instituicao_id = ${s.instituicaoId}::uuid AND (${!ligar} OR codigo_hash IS NOT NULL)`;
      if (n === 0) return { codigo: 409, corpo: { erro: 'Gere um código primeiro.' } };
      await auditar(
        tx,
        s,
        `acompanhamento_instituicao.codigo_${ligar ? 'ligado' : 'desligado'}`,
        `instituicao:${s.instituicaoId}`,
      );
      return { codigo: 200, corpo: { ativo: ligar } };
    },
  );

  // ---------- Fila do Pedagógico: só o nome do aluno e as caixas pedidas ----------
  rota('get', '/fila', podeAcompanharPorInstituicao, {}, async ({ tx, s }) => {
    const fila = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM acompanhamento_fila(${s.instituicaoId}::uuid)`;
    return { codigo: 200, corpo: { pedidos: fila } };
  });
  rota(
    'post',
    '/fila/:id/aceitar',
    podeAcompanharPorInstituicao,
    { params: idParam },
    async ({ tx, s, params }) => {
      const [r] = await tx.$queryRaw<{ r: string }[]>`
      SELECT acompanhamento_instituicao_aceitar(${s.instituicaoId}::uuid, ${s.usuarioId}::uuid, ${params.id}::uuid) AS r`;
      if (r?.r !== 'ok') return naoAchou;
      await auditar(tx, s, 'acompanhamento_instituicao.aceito', `acompanhamento:${params.id}`);
      return { codigo: 200, corpo: { ok: true } };
    },
  );
  rota(
    'post',
    '/fila/:id/recusar',
    podeAcompanharPorInstituicao,
    { params: idParam, corpo: corpoJustificativa },
    async ({ tx, s, params, corpo }) => {
      const [r] = await tx.$queryRaw<{ r: boolean }[]>`
      SELECT acompanhamento_instituicao_encerrar(${s.instituicaoId}::uuid, ${params.id}::uuid, ${corpo.justificativa}) AS r`;
      if (!r?.r) return naoAchou;
      await auditar(tx, s, 'acompanhamento_instituicao.recusado', `acompanhamento:${params.id}`);
      return { codigo: 200, corpo: { ok: true } };
    },
  );

  // ---------- Vínculos aceitos: Admin e Pedagógico gerenciam; só nome e caixas ----------
  rota('get', '/vinculos', podeGerirVinculosInstituicao, {}, async ({ tx, s }) => {
    const lista = await tx.$queryRaw<Vinculo[]>`
      SELECT * FROM acompanhamento_instituicao_vinculos(${s.instituicaoId}::uuid)`;
    const nomes = new Map(
      (
        await tx.$queryRaw<{ id: string; nome: string }[]>`
          SELECT id, nome FROM usuario WHERE id = ANY(${lista.map((v) => v.usuario_id)}::uuid[])`
      ).map((u) => [u.id, u.nome]),
    );
    return {
      codigo: 200,
      corpo: {
        vinculos: lista.map((v) => ({
          id: v.acompanhamento_id,
          aluno_nome: v.aluno_nome,
          acompanhante_nome: nomes.get(v.usuario_id) ?? '',
          meu: v.usuario_id === s.usuarioId,
          situacao: v.situacao,
          fim_em: dia(v.fim_em),
          dias_restantes: v.dias_restantes,
          vencido: v.vencido,
          aviso: avisoDeValidade(v.dias_restantes),
          aviso_pendente: v.usuario_id === s.usuarioId && v.aviso_pendente,
          ver_tarefas: v.ver_tarefas,
          ver_dificuldade: v.ver_dificuldade,
          ver_notas: v.ver_notas,
          ver_mensagens: v.ver_mensagens,
        })),
      },
    };
  });
  rota(
    'post',
    '/vinculos/renovar',
    podeGerirVinculosInstituicao,
    { corpo: corpoLote },
    async ({ tx, s, corpo }) => {
      const [r] = await tx.$queryRaw<{ n: number }[]>`
      SELECT acompanhamento_instituicao_renovar(${s.instituicaoId}::uuid, ${corpo.ids}::uuid[]) AS n`;
      await auditar(
        tx,
        s,
        'acompanhamento_instituicao.renovado_em_lote',
        `instituicao:${s.instituicaoId}`,
        { quantos: r?.n ?? 0 },
      );
      return { codigo: 200, corpo: { renovados: r?.n ?? 0 } };
    },
  );
  rota(
    'post',
    '/vinculos/:id/encerrar',
    podeGerirVinculosInstituicao,
    { params: idParam, corpo: corpoJustificativa },
    async ({ tx, s, params, corpo }) => {
      const [r] = await tx.$queryRaw<{ r: boolean }[]>`
      SELECT acompanhamento_instituicao_encerrar(${s.instituicaoId}::uuid, ${params.id}::uuid, ${corpo.justificativa}) AS r`;
      if (!r?.r) return naoAchou;
      await auditar(tx, s, 'acompanhamento_instituicao.encerrado', `acompanhamento:${params.id}`);
      return { codigo: 200, corpo: { ok: true } };
    },
  );
  rota(
    'post',
    '/vinculos/:id/aviso',
    podeAcompanharPorInstituicao,
    { params: idParam },
    async ({ tx, s, params }) => {
      const [r] = await tx.$queryRaw<{ r: boolean }[]>`
      SELECT acompanhamento_instituicao_aviso_visto(${s.instituicaoId}::uuid, ${s.usuarioId}::uuid, ${params.id}::uuid) AS r`;
      return r?.r ? { codigo: 200, corpo: { ok: true } } : naoAchou;
    },
  );

  // Leitura de UM item de UM aluno pelo Pedagógico que aceitou. Cada leitura fica na auditoria do espaço do aluno, sem o valor.
  rota(
    'get',
    '/vinculos/:id/:item',
    podeAcompanharPorInstituicao,
    { params: itemParam },
    async ({ tx, s, params }) => {
      const [r] = await tx.$queryRaw<{ instituicao_id: string; dados: unknown }[]>`
      SELECT * FROM acompanhamento_instituicao_ler(${s.instituicaoId}::uuid, ${s.usuarioId}::uuid, ${params.id}::uuid, ${params.item})`;
      if (!r) return { codigo: 403, corpo: { erro: 'Você não tem acesso a este item.' } };
      await auditar(tx, s, 'acompanhamento_instituicao.leitura', `acompanhamento:${params.id}`, {
        item: params.item,
      });
      // E também no espaço do aluno (quem lê, de qual instituição, qual item), sem o valor lido
      await withTenant(opcoes.banco, { instituicaoId: r.instituicao_id }, (tx2) =>
        registrarAuditoria(tx2, {
          instituicaoId: r.instituicao_id,
          ator: `usuario:${s.usuarioId}@instituicao:${s.instituicaoId}`,
          acao: 'acompanhamento.leitura',
          alvo: `acompanhamento:${params.id}`,
          depois: { item: params.item },
        }),
      );
      return { codigo: 200, corpo: { item: params.item, dados: r.dados } };
    },
  );
}
