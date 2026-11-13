import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registrarAuditoria } from '../auditoria/auditoria.js';
import type { SessaoAtiva } from '../auth/autenticacao.js';
import { podeVerComoRepresentante } from '../auth/politica.js';
import { type withTenant as WithTenant, withTenant } from '../banco/withTenant.js';

// L22a-3: "Meu aluno". O representante legal de aluno MENOR lê tudo, só leitura (A-074 N2, A-091). Só GET.
// Não recebe id de aluno: o aluno é o do vínculo legal ativo do próprio usuário (função do banco). Um item por vez, sem lista de
// alunos, média, ordem por dificuldade nem comparação. Cada leitura vai para a auditoria, sem o valor.
// Aluno com 18 anos ou mais: nada é lido aqui; o acesso passa a valer só pelas caixas do aluno (representante indicado).
type Banco = Parameters<typeof WithTenant>[0];
type Exigir = (req: FastifyRequest, res: FastifyReply) => Promise<SessaoAtiva | null>;

export const ITENS_REPRESENTADO = [
  'tarefas',
  'agenda',
  'notas',
  'mensagens',
  'disciplinas',
  'dificuldade',
] as const;
const itemParam = z.strictObject({ item: z.enum(ITENS_REPRESENTADO) });

export function registrarRepresentado(
  app: FastifyInstance,
  opcoes: { banco: Banco; exigirSessao: Exigir },
): void {
  // Entrada comum: sessão completa e perfil responsavel; senão 403 auditado
  async function entrar(req: FastifyRequest, res: FastifyReply, rotulo: string) {
    const s = await opcoes.exigirSessao(req, res);
    if (!s) return null;
    if (s.nivel !== 'completo' || !podeVerComoRepresentante(s.perfil)) {
      await withTenant(opcoes.banco, { instituicaoId: s.instituicaoId }, (tx) =>
        registrarAuditoria(tx, {
          instituicaoId: s.instituicaoId,
          ator: `usuario:${s.usuarioId}`,
          acao: 'representado.acesso_negado',
          alvo: rotulo,
        }),
      );
      res.code(403).send({ erro: 'Sem permissão.' });
      return null;
    }
    return s;
  }

  app.get('/representado', async (req, res) => {
    const s = await entrar(req, res, 'GET /representado');
    if (!s) return res;
    const [f] = await withTenant(
      opcoes.banco,
      { instituicaoId: s.instituicaoId },
      (tx) =>
        tx.$queryRaw<
          {
            aluno_nome: string;
            menor: boolean;
            maior_em: string | null;
            dias_para_18: number | null;
          }[]
        >`SELECT aluno_nome, menor, to_char(maior_em, 'YYYY-MM-DD') AS maior_em, dias_para_18
          FROM representado_ficha(${s.instituicaoId}::uuid, ${s.usuarioId}::uuid)`,
    );
    if (!f) return res.code(403).send({ erro: 'Sem permissão.' });
    return res.send(f);
  });

  app.get('/representado/:item', async (req, res) => {
    const s = await entrar(req, res, 'GET /representado/:item');
    if (!s) return res;
    const p = itemParam.safeParse(req.params);
    if (!p.success) return res.code(400).send({ erro: 'Dados inválidos.' });
    // F-056: a resposta só sai depois do COMMIT (a auditoria entra na mesma transação)
    const r = await withTenant(opcoes.banco, { instituicaoId: s.instituicaoId }, async (tx) => {
      const [l] = await tx.$queryRaw<{ situacao: string; dados: unknown }[]>`
        SELECT situacao, dados FROM representado_ler(${s.instituicaoId}::uuid, ${s.usuarioId}::uuid, ${p.data.item})`;
      if (!l) return { codigo: 403, corpo: { erro: 'Sem permissão.' } };
      if (l.situacao !== 'ok')
        return {
          codigo: 403,
          corpo: {
            maior: true,
            erro: 'O aluno tem 18 anos ou mais. Você vê só o que ele liberar em "Quem pode ver meus dados".',
          },
        };
      await registrarAuditoria(tx, {
        instituicaoId: s.instituicaoId,
        ator: `usuario:${s.usuarioId}`,
        acao: 'representado.leitura',
        alvo: `espaco:${s.instituicaoId}`,
        depois: { item: p.data.item },
      });
      return { codigo: 200, corpo: { item: p.data.item, dados: l.dados } };
    });
    return res.code(r.codigo).send(r.corpo);
  });
}
