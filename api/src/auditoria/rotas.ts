import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { SessaoAtiva } from '../auth/autenticacao.js';
import { podeLerAuditoriaDaEscola } from '../auth/politica.js';
import { type withTenant as WithTenant, withTenant } from '../banco/withTenant.js';
import { registrarAuditoria, verificarCadeia } from './auditoria.js';

// L22e: o Admin da escola lê a auditoria da PRÓPRIA instituição, só leitura e só o que é administrativo.
// A tabela também guarda eventos da vida do aluno (tarefas, notas pessoais, dificuldade, planos, entradas).
// Esses nunca saem: a lista abaixo é PERMITIDA (deny by default) e só vale quando quem fez é da equipe
// (Admin, Professor ou Pedagógico), conferido no banco. `antes` e `depois` nunca são lidos.
type Banco = Parameters<typeof WithTenant>[0];
type Exigir = (req: FastifyRequest, res: FastifyReply) => Promise<SessaoAtiva | null>;
type Opcoes = { banco: Banco; exigirSessao: Exigir };

const EQUIPE = ['admin', 'professor', 'pedagogico'];
const ROTULO_PERFIL: Record<string, string> = {
  admin: 'Administração',
  professor: 'Professor',
  pedagogico: 'Pedagógico e apoio',
};
export const POR_PAGINA = 50;

// Frase fixa por ação. `conta` é o nome da pessoa-alvo (ou "uma conta" se não houver).
export const FRASES_ADMIN: Record<string, (conta: string) => string> = {
  'usuario.criado': (c) => `Criou a conta de ${c}`,
  'usuario.desativado': (c) => `Desativou a conta de ${c}`,
  'usuario.reativado': (c) => `Reativou a conta de ${c}`,
  'usuario.senha_redefinida': (c) => `Deu uma nova senha provisória a ${c}`,
  'conta.criada_por_convite': () => 'Criou a própria conta pelo convite',
  'instituicao.criada_por_convite': () => 'Criou a instituição pelo convite',
  'turma.criada': () => 'Criou uma turma',
  'turma.inativada': () => 'Desativou uma turma',
  'turma.reativada': () => 'Reativou uma turma',
  'disciplina.criada': () => 'Criou uma disciplina',
  'disciplina.inativada': () => 'Desativou uma disciplina',
  'disciplina.reativada': () => 'Reativou uma disciplina',
  'vinculo.criado': () => 'Criou um vínculo',
  'vinculo.inativado': () => 'Desativou um vínculo',
  'calendario_escolar.criado': () => 'Criou um item do calendário da escola',
  'calendario_escolar.editado': () => 'Editou um item do calendário da escola',
  'calendario_escolar.desativado': () => 'Desativou um item do calendário da escola',
  'regra_nota.versao_criada': () => 'Criou uma nova versão das regras de notas',
  'identidade.versao_criada': () => 'Criou uma nova versão da identidade da escola',
  'aviso.publicado': () => 'Publicou um aviso da escola',
  'aviso.desativado': () => 'Desativou um aviso da escola',
  'auditoria.leitura': () => 'Abriu a tela de Auditoria',
  // Entrada, falha de entrada, bloqueio e saída: só da equipe (Q1 = B, A-118)
  'auth.login_ok': () => 'Entrou no sistema',
  'auth.login_falhou': () => 'Tentou entrar e errou a senha ou o código',
  'auth.login_bloqueado': () => 'Tentou entrar com a conta bloqueada',
  'auth.conta_bloqueada': () => 'Teve a conta bloqueada por tentativas erradas',
  'auth.logout': () => 'Saiu do sistema',
};
const ACOES_PERMITIDAS = Object.keys(FRASES_ADMIN);

const consulta = z.strictObject({ antes: z.coerce.number().int().positive().optional() });

type Linha = {
  seq: bigint;
  acao: string;
  criado_em: Date;
  ator_nome: string;
  ator_perfil: string;
  alvo_nome: string | null;
};

export function registrarAuditoriaEscola(app: FastifyInstance, opcoes: Opcoes): void {
  app.get('/auditoria', async (req, res) => {
    const sessao = await opcoes.exigirSessao(req, res);
    if (!sessao) return res;
    const tenant = { instituicaoId: sessao.instituicaoId };
    if (sessao.nivel !== 'completo' || !podeLerAuditoriaDaEscola(sessao.perfil)) {
      await withTenant(opcoes.banco, tenant, (tx) =>
        registrarAuditoria(tx, {
          instituicaoId: sessao.instituicaoId,
          ator: `usuario:${sessao.usuarioId}`,
          acao: 'auditoria.acesso_negado',
          alvo: 'GET /auditoria',
          depois: { perfil: sessao.perfil },
        }),
      );
      return res.code(403).send({ erro: 'Sem permissão.' });
    }
    const c = consulta.safeParse(req.query);
    if (!c.success) return res.code(400).send({ erro: 'Dados inválidos.' });
    const antes = c.data.antes ?? null;
    return withTenant(opcoes.banco, tenant, async (tx) => {
      // Só a primeira página registra a leitura (quem abriu e quando; nunca o que viu)
      if (antes === null)
        await registrarAuditoria(tx, {
          instituicaoId: sessao.instituicaoId,
          ator: `usuario:${sessao.usuarioId}`,
          acao: 'auditoria.leitura',
        });
      // A leitura do banco só enxerga a cadeia desta instituição (RLS). Sem `antes` e `depois`.
      const linhas = await tx.$queryRaw<Linha[]>`
        SELECT e.seq, e.acao, e.criado_em, ua.nome AS ator_nome, ua.perfil AS ator_perfil, ut.nome AS alvo_nome
          FROM auditoria_evento e
          JOIN usuario ua ON e.ator = 'usuario:' || ua.id::text AND ua.perfil = ANY(${EQUIPE}::text[])
          LEFT JOIN usuario ut ON e.alvo = 'usuario:' || ut.id::text
         WHERE e.acao = ANY(${ACOES_PERMITIDAS}::text[])
           AND (${antes}::bigint IS NULL OR e.seq < ${antes}::bigint)
         ORDER BY e.seq DESC
         LIMIT ${POR_PAGINA + 1}`;
      const problemas = antes === null ? await verificarCadeia(tx) : [];
      const pagina = linhas.slice(0, POR_PAGINA);
      return {
        integra: antes === null ? problemas.length === 0 : null,
        tem_mais: linhas.length > POR_PAGINA,
        eventos: pagina.map((l) => ({
          seq: Number(l.seq),
          quando: l.criado_em.toISOString(),
          quem: l.ator_nome,
          perfil: ROTULO_PERFIL[l.ator_perfil] ?? 'Equipe',
          frase: (FRASES_ADMIN[l.acao] ?? (() => 'Ação administrativa'))(
            l.alvo_nome ?? 'uma conta',
          ),
        })),
      };
    });
  });
}
