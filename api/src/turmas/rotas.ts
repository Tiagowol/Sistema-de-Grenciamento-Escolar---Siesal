import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registrarAuditoria } from '../auditoria/auditoria.js';
import type { SessaoAtiva } from '../auth/autenticacao.js';
import { podeAdministrarTurmas } from '../auth/politica.js';
import {
  type ClienteTransacao,
  type withTenant as WithTenant,
  withTenant,
} from '../banco/withTenant.js';
import { criarRespostaAdiada, enviarGuardada } from '../banco/resposta-adiada.js';

type Banco = Parameters<typeof WithTenant>[0];
type Exigir = (req: FastifyRequest, res: FastifyReply) => Promise<SessaoAtiva | null>;
type Opcoes = { banco: Banco; exigirSessao: Exigir };
type Linha = Record<string, unknown>;

const uuid = z.uuid();
const idParam = z.strictObject({ id: uuid });
const corpoTurma = z.strictObject({
  nome: z.string().trim().min(1).max(80),
  ano_letivo: z.number().int().min(2000).max(2100),
  turno: z.enum(['manha', 'tarde', 'noite']),
});
const corpoDisciplina = z.strictObject({ nome: z.string().trim().min(1).max(80) });
// Cada tipo de vínculo exige os seus campos e proíbe os outros
const corpoVinculo = z.discriminatedUnion('tipo', [
  z.strictObject({
    tipo: z.literal('professor_turma'),
    usuario_id: uuid,
    turma_id: uuid,
    disciplina_id: uuid,
  }),
  z.strictObject({ tipo: z.literal('aluno_turma'), usuario_id: uuid, turma_id: uuid }),
  z.strictObject({ tipo: z.literal('responsavel_aluno'), usuario_id: uuid, aluno_id: uuid }),
]);
const PERFIL_DO_TIPO = {
  professor_turma: 'professor',
  aluno_turma: 'aluno',
  responsavel_aluno: 'responsavel',
} as const;

export function registrarTurmas(app: FastifyInstance, opcoes: Opcoes): void {
  // Rota do Admin: sessão completa, perfil permitido pela matriz e transação da instituição.
  // Perfil sem permissão é negado (403) e a tentativa vai para a auditoria.
  function rota<P extends z.ZodType = z.ZodUndefined, B extends z.ZodType = z.ZodUndefined>(
    metodo: 'get' | 'post',
    caminho: string,
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
      if (sessao.nivel !== 'completo' || !podeAdministrarTurmas(sessao.perfil)) {
        await withTenant(opcoes.banco, { instituicaoId: sessao.instituicaoId }, (tx) =>
          registrarAuditoria(tx, {
            instituicaoId: sessao.instituicaoId,
            ator: `usuario:${sessao.usuarioId}`,
            acao: 'turmas.acesso_negado',
            alvo: caminho,
          }),
        );
        return res.code(403).send({ erro: 'Sem permissão.' });
      }
      const ler = (esquema: z.ZodType | undefined, valor: unknown) =>
        esquema ? esquema.safeParse(valor) : ({ success: true, data: undefined } as const);
      const params = ler(esquemas.params, req.params);
      const corpo = ler(esquemas.corpo, req.body);
      if (!params.success || !corpo.success) {
        return res.code(400).send({ erro: 'Dados inválidos.' });
      }
      // F-056: a resposta guardada só sai depois do COMMIT
      const adiada = criarRespostaAdiada();
      const saida = await withTenant(opcoes.banco, { instituicaoId: sessao.instituicaoId }, (tx) =>
        funcao({
          tx,
          sessao,
          params: params.data as never,
          corpo: corpo.data as never,
          resposta: adiada.resposta as unknown as FastifyReply,
        }),
      );
      const enviada = enviarGuardada(res, adiada.guardado());
      if (enviada) return enviada;
      return saida === undefined ? res.code(204).send() : saida;
    });
  }
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
  const naoAchou = (r: FastifyReply) => r.code(404).send({ erro: 'Não encontrado.' });

  // ---------- Turmas ----------
  rota('get', '/turmas', {}, async ({ tx }) => ({
    turmas: await tx.$queryRaw<Linha[]>`
      SELECT t.id, t.nome, t.ano_letivo, t.turno, t.criado_em::date::text AS criado_em,
             t.desativado_em IS NULL AS ativa,
             (SELECT count(*)::int FROM vinculo v WHERE v.turma_id = t.id AND v.tipo = 'aluno_turma'
                 AND v.desativado_em IS NULL) AS alunos,
             (SELECT count(DISTINCT v.usuario_id)::int FROM vinculo v WHERE v.turma_id = t.id
                 AND v.tipo = 'professor_turma' AND v.desativado_em IS NULL) AS professores
        FROM turma t
       ORDER BY (t.desativado_em IS NOT NULL), t.ano_letivo DESC, t.nome`,
  }));

  rota('post', '/turmas', { corpo: corpoTurma }, async ({ tx, sessao, corpo, resposta }) => {
    const repetida = await tx.$queryRaw<Linha[]>`
      SELECT 1 FROM turma WHERE desativado_em IS NULL AND ano_letivo = ${corpo.ano_letivo}
         AND lower(btrim(nome)) = lower(${corpo.nome})`;
    if (repetida.length) {
      return resposta.code(409).send({ erro: 'Já existe turma ativa com este nome neste ano.' });
    }
    const [nova] = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO turma (instituicao_id, nome, ano_letivo, turno)
      VALUES (${sessao.instituicaoId}::uuid, ${corpo.nome}, ${corpo.ano_letivo}, ${corpo.turno})
      RETURNING id`;
    if (!nova) throw new Error('Falha ao criar turma.');
    await auditar(tx, sessao, 'turma.criada', `turma:${nova.id}`, corpo);
    return resposta.code(201).send({ id: nova.id });
  });

  rota('post', '/turmas/:id/inativar', { params: idParam }, async (c) => {
    const mudou = await c.tx.$executeRaw`
      UPDATE turma SET desativado_em = now() WHERE id = ${c.params.id}::uuid AND desativado_em IS NULL`;
    if (!mudou) return naoAchou(c.resposta);
    await auditar(c.tx, c.sessao, 'turma.inativada', `turma:${c.params.id}`);
    return undefined;
  });

  rota('post', '/turmas/:id/reativar', { params: idParam }, async (c) => {
    const [turma] = await c.tx.$queryRaw<{ ano_letivo: number; nome: string }[]>`
      SELECT ano_letivo, nome FROM turma WHERE id = ${c.params.id}::uuid AND desativado_em IS NOT NULL`;
    if (!turma) return naoAchou(c.resposta);
    const repetida = await c.tx.$queryRaw<Linha[]>`
      SELECT 1 FROM turma WHERE desativado_em IS NULL AND ano_letivo = ${turma.ano_letivo}
         AND lower(btrim(nome)) = lower(${turma.nome})`;
    if (repetida.length) {
      return c.resposta.code(409).send({ erro: 'Já existe turma ativa com este nome neste ano.' });
    }
    await c.tx.$executeRaw`UPDATE turma SET desativado_em = NULL WHERE id = ${c.params.id}::uuid`;
    await auditar(c.tx, c.sessao, 'turma.reativada', `turma:${c.params.id}`);
    return undefined;
  });

  // ---------- Disciplinas ----------
  rota('get', '/disciplinas', {}, async ({ tx }) => ({
    disciplinas: await tx.$queryRaw<Linha[]>`
      SELECT id, nome, criado_em::date::text AS criado_em, desativado_em IS NULL AS ativa
        FROM disciplina ORDER BY (desativado_em IS NOT NULL), nome`,
  }));

  rota('post', '/disciplinas', { corpo: corpoDisciplina }, async (c) => {
    const repetida = await c.tx.$queryRaw<Linha[]>`
      SELECT 1 FROM disciplina WHERE desativado_em IS NULL AND lower(btrim(nome)) = lower(${c.corpo.nome})`;
    if (repetida.length) {
      return c.resposta.code(409).send({ erro: 'Já existe disciplina ativa com este nome.' });
    }
    const [nova] = await c.tx.$queryRaw<{ id: string }[]>`
      INSERT INTO disciplina (instituicao_id, nome) VALUES (${c.sessao.instituicaoId}::uuid, ${c.corpo.nome})
      RETURNING id`;
    if (!nova) throw new Error('Falha ao criar disciplina.');
    await auditar(c.tx, c.sessao, 'disciplina.criada', `disciplina:${nova.id}`, c.corpo);
    return c.resposta.code(201).send({ id: nova.id });
  });

  rota('post', '/disciplinas/:id/inativar', { params: idParam }, async (c) => {
    const mudou = await c.tx.$executeRaw`
      UPDATE disciplina SET desativado_em = now() WHERE id = ${c.params.id}::uuid AND desativado_em IS NULL`;
    if (!mudou) return naoAchou(c.resposta);
    await auditar(c.tx, c.sessao, 'disciplina.inativada', `disciplina:${c.params.id}`);
    return undefined;
  });

  rota('post', '/disciplinas/:id/reativar', { params: idParam }, async (c) => {
    const [d] = await c.tx.$queryRaw<{ nome: string }[]>`
      SELECT nome FROM disciplina WHERE id = ${c.params.id}::uuid AND desativado_em IS NOT NULL`;
    if (!d) return naoAchou(c.resposta);
    const repetida = await c.tx.$queryRaw<Linha[]>`
      SELECT 1 FROM disciplina WHERE desativado_em IS NULL AND lower(btrim(nome)) = lower(${d.nome})`;
    if (repetida.length) {
      return c.resposta.code(409).send({ erro: 'Já existe disciplina ativa com este nome.' });
    }
    await c.tx
      .$executeRaw`UPDATE disciplina SET desativado_em = NULL WHERE id = ${c.params.id}::uuid`;
    await auditar(c.tx, c.sessao, 'disciplina.reativada', `disciplina:${c.params.id}`);
    return undefined;
  });

  // ---------- Vínculos ----------
  rota('get', '/vinculos', {}, async ({ tx }) => ({
    vinculos: await tx.$queryRaw<Linha[]>`
      SELECT v.id, v.tipo, v.criado_em::date::text AS criado_em,
             v.usuario_id, u.nome AS usuario_nome,
             v.turma_id, t.nome AS turma_nome,
             v.disciplina_id, d.nome AS disciplina_nome,
             v.aluno_id, a.nome AS aluno_nome
        FROM vinculo v
        JOIN usuario u ON u.id = v.usuario_id
        LEFT JOIN turma t ON t.id = v.turma_id
        LEFT JOIN disciplina d ON d.id = v.disciplina_id
        LEFT JOIN usuario a ON a.id = v.aluno_id
       WHERE v.desativado_em IS NULL
       ORDER BY v.tipo, t.nome NULLS LAST, u.nome`,
  }));

  rota('post', '/vinculos', { corpo: corpoVinculo }, async ({ tx, sessao, corpo, resposta }) => {
    const invalido = (m: string) => resposta.code(400).send({ erro: m });
    // A pessoa precisa existir, estar ativa e ter o perfil certo para o tipo
    const [pessoa] = await tx.$queryRaw<{ perfil: string }[]>`
      SELECT perfil FROM usuario
       WHERE id = ${corpo.usuario_id}::uuid AND situacao = 'ativo' AND desativado_em IS NULL`;
    if (!pessoa) return invalido('Pessoa não encontrada ou inativa.');
    if (pessoa.perfil !== PERFIL_DO_TIPO[corpo.tipo]) {
      return invalido(`Esta pessoa não tem o perfil ${PERFIL_DO_TIPO[corpo.tipo]}.`);
    }
    const turmaId = 'turma_id' in corpo ? corpo.turma_id : null;
    const disciplinaId = 'disciplina_id' in corpo ? corpo.disciplina_id : null;
    const alunoId = 'aluno_id' in corpo ? corpo.aluno_id : null;
    if (turmaId) {
      const ok = await tx.$queryRaw<Linha[]>`
        SELECT 1 FROM turma WHERE id = ${turmaId}::uuid AND desativado_em IS NULL`;
      if (!ok.length) return invalido('Turma não encontrada ou inativa.');
    }
    if (disciplinaId) {
      const ok = await tx.$queryRaw<Linha[]>`
        SELECT 1 FROM disciplina WHERE id = ${disciplinaId}::uuid AND desativado_em IS NULL`;
      if (!ok.length) return invalido('Disciplina não encontrada ou inativa.');
    }
    if (alunoId) {
      const ok = await tx.$queryRaw<Linha[]>`
        SELECT 1 FROM usuario
         WHERE id = ${alunoId}::uuid AND perfil = 'aluno' AND situacao = 'ativo' AND desativado_em IS NULL`;
      if (!ok.length) return invalido('Aluno não encontrado ou inativo.');
    }
    const repetido = await tx.$queryRaw<Linha[]>`
      SELECT 1 FROM vinculo
       WHERE desativado_em IS NULL AND tipo = ${corpo.tipo} AND usuario_id = ${corpo.usuario_id}::uuid
         AND turma_id IS NOT DISTINCT FROM ${turmaId}::uuid
         AND disciplina_id IS NOT DISTINCT FROM ${disciplinaId}::uuid
         AND aluno_id IS NOT DISTINCT FROM ${alunoId}::uuid`;
    if (repetido.length) return resposta.code(409).send({ erro: 'Este vínculo já existe.' });
    const [novo] = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO vinculo (instituicao_id, tipo, usuario_id, turma_id, disciplina_id, aluno_id)
      VALUES (${sessao.instituicaoId}::uuid, ${corpo.tipo}, ${corpo.usuario_id}::uuid,
              ${turmaId}::uuid, ${disciplinaId}::uuid, ${alunoId}::uuid)
      RETURNING id`;
    if (!novo) throw new Error('Falha ao criar vínculo.');
    await auditar(tx, sessao, 'vinculo.criado', `vinculo:${novo.id}`, corpo);
    return resposta.code(201).send({ id: novo.id });
  });

  rota('post', '/vinculos/:id/inativar', { params: idParam }, async (c) => {
    const mudou = await c.tx.$executeRaw`
      UPDATE vinculo SET desativado_em = now() WHERE id = ${c.params.id}::uuid AND desativado_em IS NULL`;
    if (!mudou) return naoAchou(c.resposta);
    await auditar(c.tx, c.sessao, 'vinculo.inativado', `vinculo:${c.params.id}`);
    return undefined;
  });
}
