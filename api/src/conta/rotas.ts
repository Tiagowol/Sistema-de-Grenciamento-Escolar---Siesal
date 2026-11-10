import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registrarAuditoria } from '../auditoria/auditoria.js';
import type { SessaoAtiva } from '../auth/autenticacao.js';
import {
  podeAdministrarConta,
  podeAdministrarInterface,
  podeAtenderSuporte,
  podeDecidirContaDeMenor,
  podePedirSuporte,
} from '../auth/politica.js';
import { verificarSenha } from '../auth/senha.js';
import {
  type ClienteTransacao,
  type withTenant as WithTenant,
  withTenant,
} from '../banco/withTenant.js';

// Conta e suporte (L17c). Trocar e-mail e encerrar conta têm duas etapas: o pedido (com a senha atual) e a
// confirmação. Aluno é menor de idade: quem confirma é o Responsável vinculado ou o Admin (A-032).
// Encerrar = desativar e anonimizar. Auditoria e notas oficiais não se apagam: ficam sem ligação com a pessoa.
type Banco = Parameters<typeof WithTenant>[0];
type Exigir = (req: FastifyRequest, res: FastifyReply) => Promise<SessaoAtiva | null>;
type Opcoes = {
  banco: Banco;
  exigirSessao: Exigir;
  limitar: (req: FastifyRequest, res: FastifyReply) => boolean;
};
type Linha = Record<string, unknown>;

export const ASSUNTOS_SUPORTE = [
  'acesso',
  'nao_consigo_usar',
  'duvida_nota',
  'erro_na_tela',
  'outro',
] as const;
export const MAXIMO_SUPORTE_ABERTOS = 3;

const uuid = z.uuid();
const idParam = z.strictObject({ id: uuid });
const senhaAtual = z.string().min(1).max(128);
const semLink = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((t) => !/(https?:|www\.|:\/\/)/i.test(t), 'Não use links.');

// O aluno é sempre tratado como menor de idade (o cadastro não guarda data de nascimento)
const ehMenor = (perfil: string) => perfil === 'aluno';

export function registrarConta(app: FastifyInstance, opcoes: Opcoes): void {
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
  function rota<P extends z.ZodType = z.ZodUndefined, B extends z.ZodType = z.ZodUndefined>(
    metodo: 'get' | 'post',
    caminho: string,
    permite: (perfil: string) => boolean,
    esquemas: { params?: P; corpo?: B; limitar?: boolean },
    funcao: (c: {
      tx: ClienteTransacao;
      sessao: SessaoAtiva;
      params: z.infer<P>;
      corpo: z.infer<B>;
      resposta: FastifyReply;
    }) => Promise<unknown>,
  ): void {
    app[metodo](caminho, async (req, res) => {
      // Rotas que testam a senha entram no limite por IP
      if (esquemas.limitar && !opcoes.limitar(req, res)) return res;
      const sessao = await opcoes.exigirSessao(req, res);
      if (!sessao) return res;
      if (sessao.nivel !== 'completo' || !permite(sessao.perfil)) {
        await withTenant(opcoes.banco, { instituicaoId: sessao.instituicaoId }, (tx) =>
          auditar(tx, sessao, 'conta.acesso_negado', `${metodo.toUpperCase()} ${caminho}`, {
            perfil: sessao.perfil,
          }),
        );
        return res.code(403).send({ erro: 'Sem permissão.' });
      }
      const params = esquemas.params ? esquemas.params.safeParse(req.params) : null;
      const corpo = esquemas.corpo ? esquemas.corpo.safeParse(req.body ?? {}) : null;
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

  const senhaConfere = async (tx: ClienteTransacao, sessao: SessaoAtiva, senha: string) => {
    const [c] = await tx.$queryRaw<{ senha_hash: string }[]>`
      SELECT senha_hash FROM credencial WHERE usuario_id = ${sessao.usuarioId}::uuid`;
    return c ? verificarSenha(senha, c.senha_hash) : false;
  };

  const ehResponsavelDe = async (tx: ClienteTransacao, responsavelId: string, alunoId: string) =>
    (
      await tx.$queryRaw<Linha[]>`
        SELECT 1 AS x FROM vinculo WHERE tipo = 'responsavel_aluno' AND usuario_id = ${responsavelId}::uuid
           AND aluno_id = ${alunoId}::uuid AND desativado_em IS NULL`
    ).length > 0;
  const temResponsavel = async (tx: ClienteTransacao, alunoId: string) =>
    (
      await tx.$queryRaw<Linha[]>`
        SELECT 1 AS x FROM vinculo v JOIN usuario r ON r.id = v.usuario_id AND r.desativado_em IS NULL
         WHERE v.tipo = 'responsavel_aluno' AND v.aluno_id = ${alunoId}::uuid AND v.desativado_em IS NULL`
    ).length > 0;

  // Quem pode decidir o pedido de um aluno (menor): e-mail = Responsável vinculado ou Admin;
  // encerramento = Responsável e, na falta dele, o Admin
  const podeDecidir = async (
    tx: ClienteTransacao,
    decisor: SessaoAtiva,
    pedido: { usuario_id: string; tipo: string },
  ) => {
    if (decisor.perfil === 'responsavel')
      return ehResponsavelDe(tx, decisor.usuarioId, pedido.usuario_id);
    if (decisor.perfil === 'admin')
      return pedido.tipo === 'email' || !(await temResponsavel(tx, pedido.usuario_id));
    return false;
  };

  // Desativa e anonimiza. O que é texto pessoal vira "Removido"; auditoria, notas oficiais e versões ficam,
  // sem nome nem e-mail que levem à pessoa.
  async function encerrar(tx: ClienteTransacao, id: string) {
    await tx.$executeRaw`
      UPDATE usuario SET nome = 'Conta encerrada', email = ${`encerrada-${id}@anonimo.invalid`},
             situacao = 'inativo', desativado_em = now(), encerrada_em = now()
       WHERE id = ${id}::uuid`;
    await tx.$executeRaw`
      UPDATE credencial SET senha_hash = 'conta-encerrada', totp_segredo_cifrado = NULL, totp_ativo = false,
             bloqueado_ate = NULL, atualizado_em = now() WHERE usuario_id = ${id}::uuid`;
    await tx.$executeRaw`UPDATE sessao SET revogada_em = now() WHERE usuario_id = ${id}::uuid AND revogada_em IS NULL`;
    await tx.$executeRaw`UPDATE codigo_recuperacao SET usado_em = now() WHERE usuario_id = ${id}::uuid AND usado_em IS NULL`;
    await tx.$executeRaw`UPDATE vinculo SET desativado_em = now() WHERE (usuario_id = ${id}::uuid OR aluno_id = ${id}::uuid) AND desativado_em IS NULL`;
    await tx.$executeRaw`UPDATE preferencia_usuario SET apelido = NULL, atualizado_em = now() WHERE usuario_id = ${id}::uuid`;
    await tx.$executeRaw`UPDATE tipo_atividade SET nome = 'Removido', desativado_em = coalesce(desativado_em, now()) WHERE usuario_id = ${id}::uuid`;
    await tx.$executeRaw`UPDATE tarefa SET titulo = 'Removido', descricao = '', disciplina = '', desativado_em = coalesce(desativado_em, now()) WHERE usuario_id = ${id}::uuid`;
    await tx.$executeRaw`UPDATE microetapa SET texto = 'Removido', desativado_em = coalesce(desativado_em, now()) WHERE usuario_id = ${id}::uuid`;
    await tx.$executeRaw`UPDATE evento SET titulo = 'Removido', desativado_em = coalesce(desativado_em, now()) WHERE usuario_id = ${id}::uuid`;
    await tx.$executeRaw`UPDATE evento_versao SET titulo = 'Removido' WHERE evento_id IN (SELECT id FROM evento WHERE usuario_id = ${id}::uuid)`;
    await tx.$executeRaw`UPDATE nota_pessoal SET descricao = '', desativado_em = coalesce(desativado_em, now()) WHERE usuario_id = ${id}::uuid`;
    await tx.$executeRaw`UPDATE pedido_ajuda SET texto = '' WHERE aluno_id = ${id}::uuid`;
    await tx.$executeRaw`UPDATE pedido_suporte SET texto = '(removido)' WHERE usuario_id = ${id}::uuid`;
    await tx.$executeRaw`UPDATE pedido_conta SET email_novo = 'removido@anonimo.invalid' WHERE usuario_id = ${id}::uuid AND email_novo IS NOT NULL`;
  }

  type PedidoConta = {
    id: string;
    usuario_id: string;
    tipo: 'email' | 'encerramento';
    email_novo: string | null;
    exige_aprovacao: boolean;
  };

  // Aplica o pedido já confirmado ou aprovado. Devolve false se o e-mail novo já foi tomado por outra pessoa.
  async function aplicar(
    tx: ClienteTransacao,
    sessao: SessaoAtiva,
    pedido: PedidoConta,
    decididoPor: string,
  ): Promise<boolean> {
    if (pedido.tipo === 'email') {
      const [outro] = await tx.$queryRaw<Linha[]>`
        SELECT id FROM usuario WHERE lower(email) = lower(${pedido.email_novo}) AND id <> ${pedido.usuario_id}::uuid`;
      if (outro) return false;
      await tx.$executeRaw`UPDATE usuario SET email = ${pedido.email_novo} WHERE id = ${pedido.usuario_id}::uuid`;
    } else {
      await encerrar(tx, pedido.usuario_id);
    }
    await tx.$executeRaw`
      UPDATE pedido_conta SET estado = 'concluido', decidido_por = ${decididoPor}::uuid, decidido_em = now()
       WHERE id = ${pedido.id}::uuid`;
    await auditar(
      tx,
      sessao,
      pedido.tipo === 'email' ? 'conta.email_trocado' : 'conta.encerrada',
      `usuario:${pedido.usuario_id}`,
      { por: decididoPor === pedido.usuario_id ? 'o próprio' : decididoPor },
    );
    return true;
  }

  const lerPedido = async (tx: ClienteTransacao, id: string) =>
    (
      await tx.$queryRaw<(PedidoConta & { estado: string })[]>`
        SELECT id, usuario_id, tipo, email_novo, exige_aprovacao, estado FROM pedido_conta WHERE id = ${id}::uuid`
    )[0];

  // ---------- Minha conta ----------
  // ---------- Preferências de interface (L17d): rótulos do topo e VLibras, por usuário ----------
  // Sem linha gravada vale o padrão: ícones, VLibras mostrado e aviso ainda não aceito.
  const lerInterface = async (tx: ClienteTransacao, sessao: SessaoAtiva) => {
    const [p] = await tx.$queryRaw<Linha[]>`
      SELECT rotulos, vlibras, (vlibras_aviso_aceito IS NOT NULL) AS vlibras_aviso_aceito
        FROM preferencia_interface WHERE usuario_id = ${sessao.usuarioId}::uuid`;
    return p ?? { rotulos: 'icones', vlibras: true, vlibras_aviso_aceito: false };
  };
  rota('get', '/conta/interface', podeAdministrarInterface, {}, async ({ tx, sessao }) => ({
    interface: await lerInterface(tx, sessao),
  }));
  rota(
    'post',
    '/conta/interface',
    podeAdministrarInterface,
    {
      corpo: z.strictObject({
        rotulos: z.enum(['icones', 'texto']),
        vlibras: z.boolean(),
        // true = a pessoa aceitou agora o aviso do VLibras; o aceite não se desfaz (fica a data do primeiro)
        vlibras_aviso_aceito: z.boolean(),
      }),
    },
    async ({ tx, sessao, corpo }) => {
      await tx.$executeRaw`
        INSERT INTO preferencia_interface (instituicao_id, usuario_id, rotulos, vlibras, vlibras_aviso_aceito)
        VALUES (${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, ${corpo.rotulos}, ${corpo.vlibras},
                CASE WHEN ${corpo.vlibras_aviso_aceito}::boolean THEN now() END)
        ON CONFLICT (instituicao_id, usuario_id) DO UPDATE SET
          rotulos = EXCLUDED.rotulos, vlibras = EXCLUDED.vlibras,
          vlibras_aviso_aceito = coalesce(preferencia_interface.vlibras_aviso_aceito, EXCLUDED.vlibras_aviso_aceito),
          atualizado_em = now()`;
      await auditar(tx, sessao, 'interface.salva', `usuario:${sessao.usuarioId}`, {
        rotulos: corpo.rotulos,
        vlibras: corpo.vlibras,
        vlibras_aviso_aceito: corpo.vlibras_aviso_aceito,
      });
      return { interface: await lerInterface(tx, sessao) };
    },
  );

  rota('get', '/conta', podeAdministrarConta, {}, async ({ tx, sessao }) => {
    const [u] = await tx.$queryRaw<
      Linha[]
    >`SELECT nome, email, perfil FROM usuario WHERE id = ${sessao.usuarioId}::uuid`;
    const pedidos = await tx.$queryRaw<Linha[]>`
      SELECT id, tipo, email_novo, estado, exige_aprovacao,
             to_char(criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia
        FROM pedido_conta WHERE usuario_id = ${sessao.usuarioId}::uuid AND estado = 'aguardando'
       ORDER BY criado_em DESC`;
    let decisoes: Linha[] = [];
    if (podeDecidirContaDeMenor(sessao.perfil)) {
      const candidatos = await tx.$queryRaw<(Linha & { usuario_id: string; tipo: string })[]>`
        SELECT p.id, p.usuario_id, p.tipo, p.email_novo, a.nome AS aluno_nome,
               to_char(p.criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia
          FROM pedido_conta p JOIN usuario a ON a.id = p.usuario_id
         WHERE p.estado = 'aguardando' AND p.exige_aprovacao ORDER BY p.criado_em`;
      for (const c of candidatos) if (await podeDecidir(tx, sessao, c)) decisoes.push(c);
    }
    decisoes = decisoes.map(({ usuario_id: _x, ...resto }) => resto);
    return { conta: { ...u, menor: ehMenor(sessao.perfil) }, pedidos, decisoes };
  });

  // Etapa 1 da troca de e-mail: pedido, com a senha atual
  rota(
    'post',
    '/conta/email',
    podeAdministrarConta,
    {
      corpo: z.strictObject({ email_novo: z.email().max(254), senha_atual: senhaAtual }),
      limitar: true,
    },
    async ({ tx, sessao, corpo, resposta }) => {
      if (!(await senhaConfere(tx, sessao, corpo.senha_atual))) {
        await auditar(tx, sessao, 'conta.senha_incorreta', `usuario:${sessao.usuarioId}`);
        return resposta.code(401).send({ erro: 'Senha atual incorreta.' });
      }
      const [mesmo] = await tx.$queryRaw<Linha[]>`
        SELECT id FROM usuario WHERE lower(email) = lower(${corpo.email_novo})`;
      if (mesmo) return resposta.code(409).send({ erro: 'Este e-mail não está disponível.' });
      const [aberto] = await tx.$queryRaw<Linha[]>`
        SELECT id FROM pedido_conta WHERE usuario_id = ${sessao.usuarioId}::uuid AND tipo = 'email' AND estado = 'aguardando'`;
      if (aberto)
        return resposta
          .code(409)
          .send({ erro: 'Você já tem um pedido de troca de e-mail aguardando.' });
      const [p] = await tx.$queryRaw<Linha[]>`
        INSERT INTO pedido_conta (instituicao_id, usuario_id, tipo, email_novo, exige_aprovacao)
        VALUES (${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, 'email', ${corpo.email_novo}, ${ehMenor(sessao.perfil)})
        RETURNING id, tipo, email_novo, estado, exige_aprovacao`;
      await auditar(tx, sessao, 'conta.email_pedido', `pedido_conta:${(p as Linha).id}`);
      return resposta.code(201).send({ pedido: p });
    },
  );

  // Etapa 1 do encerramento: pedido, com a senha atual. Nada muda ainda.
  rota(
    'post',
    '/conta/encerrar',
    podeAdministrarConta,
    { corpo: z.strictObject({ senha_atual: senhaAtual }), limitar: true },
    async ({ tx, sessao, corpo, resposta }) => {
      if (!(await senhaConfere(tx, sessao, corpo.senha_atual))) {
        await auditar(tx, sessao, 'conta.senha_incorreta', `usuario:${sessao.usuarioId}`);
        return resposta.code(401).send({ erro: 'Senha atual incorreta.' });
      }
      const [aberto] = await tx.$queryRaw<Linha[]>`
        SELECT id FROM pedido_conta WHERE usuario_id = ${sessao.usuarioId}::uuid AND tipo = 'encerramento' AND estado = 'aguardando'`;
      if (aberto)
        return resposta.code(409).send({ erro: 'Você já tem um pedido para encerrar a conta.' });
      const [p] = await tx.$queryRaw<Linha[]>`
        INSERT INTO pedido_conta (instituicao_id, usuario_id, tipo, exige_aprovacao)
        VALUES (${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, 'encerramento', ${ehMenor(sessao.perfil)})
        RETURNING id, tipo, email_novo, estado, exige_aprovacao`;
      await auditar(tx, sessao, 'conta.encerramento_pedido', `pedido_conta:${(p as Linha).id}`);
      return resposta.code(201).send({ pedido: p });
    },
  );

  // Etapa 2 (perfis adultos): a própria pessoa confirma
  rota(
    'post',
    '/conta/pedidos/:id/confirmar',
    podeAdministrarConta,
    { params: idParam },
    async ({ tx, sessao, params, resposta }) => {
      const p = await lerPedido(tx, params.id);
      if (!p || p.usuario_id !== sessao.usuarioId || p.estado !== 'aguardando')
        return resposta.code(404).send({ erro: 'Não encontrado.' });
      if (p.exige_aprovacao)
        return resposta
          .code(403)
          .send({ erro: 'Este pedido precisa da aprovação do Responsável ou do Admin.' });
      if (!(await aplicar(tx, sessao, p, sessao.usuarioId)))
        return resposta.code(409).send({ erro: 'Este e-mail não está disponível.' });
      return undefined;
    },
  );

  rota(
    'post',
    '/conta/pedidos/:id/cancelar',
    podeAdministrarConta,
    { params: idParam },
    async ({ tx, sessao, params, resposta }) => {
      const p = await lerPedido(tx, params.id);
      if (!p || p.usuario_id !== sessao.usuarioId || p.estado !== 'aguardando')
        return resposta.code(404).send({ erro: 'Não encontrado.' });
      await tx.$executeRaw`
        UPDATE pedido_conta SET estado = 'cancelado', decidido_por = ${sessao.usuarioId}::uuid, decidido_em = now()
         WHERE id = ${params.id}::uuid`;
      await auditar(tx, sessao, 'conta.pedido_cancelado', `pedido_conta:${params.id}`);
      return undefined;
    },
  );

  // Etapa 2 (aluno menor): o Responsável vinculado ou o Admin aprova ou recusa
  rota(
    'post',
    '/conta/pedidos/:id/decidir',
    podeDecidirContaDeMenor,
    { params: idParam, corpo: z.strictObject({ aprovar: z.boolean() }) },
    async ({ tx, sessao, params, corpo, resposta }) => {
      const p = await lerPedido(tx, params.id);
      if (
        !p ||
        p.estado !== 'aguardando' ||
        !p.exige_aprovacao ||
        !(await podeDecidir(tx, sessao, p))
      )
        return resposta.code(404).send({ erro: 'Não encontrado.' });
      if (!corpo.aprovar) {
        await tx.$executeRaw`
          UPDATE pedido_conta SET estado = 'recusado', decidido_por = ${sessao.usuarioId}::uuid, decidido_em = now()
           WHERE id = ${params.id}::uuid`;
        await auditar(tx, sessao, 'conta.pedido_recusado', `pedido_conta:${params.id}`);
        return undefined;
      }
      if (!(await aplicar(tx, sessao, p, sessao.usuarioId)))
        return resposta.code(409).send({ erro: 'Este e-mail não está disponível.' });
      return undefined;
    },
  );

  // ---------- Suporte ----------
  rota(
    'post',
    '/suporte',
    podePedirSuporte,
    { corpo: z.strictObject({ assunto: z.enum(ASSUNTOS_SUPORTE), texto: semLink(500) }) },
    async ({ tx, sessao, corpo, resposta }) => {
      const [abertos] = await tx.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM pedido_suporte WHERE usuario_id = ${sessao.usuarioId}::uuid AND estado = 'aberto'`;
      if ((abertos?.n ?? 0) >= MAXIMO_SUPORTE_ABERTOS)
        return resposta
          .code(409)
          .send({ erro: 'Você já tem pedidos esperando resposta. Aguarde a equipe.' });
      const [p] = await tx.$queryRaw<Linha[]>`
        INSERT INTO pedido_suporte (instituicao_id, usuario_id, assunto, texto)
        VALUES (${sessao.instituicaoId}::uuid, ${sessao.usuarioId}::uuid, ${corpo.assunto}, ${corpo.texto})
        RETURNING id, assunto, estado`;
      await auditar(tx, sessao, 'suporte.pedido', `pedido_suporte:${(p as Linha).id}`, {
        assunto: corpo.assunto,
      });
      return resposta.code(201).send({ pedido: p });
    },
  );

  rota(
    'post',
    '/suporte/:id/atender',
    podeAtenderSuporte,
    { params: idParam },
    async ({ tx, sessao, params, resposta }) => {
      const n = await tx.$executeRaw`
        UPDATE pedido_suporte SET estado = 'atendido', atendido_por = ${sessao.usuarioId}::uuid, atendido_em = now()
         WHERE id = ${params.id}::uuid AND estado = 'aberto'`;
      if (n === 0) return resposta.code(404).send({ erro: 'Não encontrado.' });
      await auditar(tx, sessao, 'suporte.atendido', `pedido_suporte:${params.id}`);
      return undefined;
    },
  );
}

const ROTULO_ASSUNTO: Record<(typeof ASSUNTOS_SUPORTE)[number], string> = {
  acesso: 'Não consigo entrar',
  nao_consigo_usar: 'Não consigo usar uma tela',
  duvida_nota: 'Dúvida sobre uma nota',
  erro_na_tela: 'Apareceu um erro',
  outro: 'Outro assunto',
};

// Itens do sino (caixa) para o Admin e o Pedagógico: pedidos de suporte esperando resposta
export async function itensDeSuporte(tx: ClienteTransacao, sessao: SessaoAtiva): Promise<Linha[]> {
  if (!podeAtenderSuporte(sessao.perfil)) return [];
  const eu = sessao.usuarioId;
  const linhas = await tx.$queryRaw<Linha[]>`
    SELECT s.id, s.assunto, s.texto, u.nome AS autor_nome, u.perfil AS autor_perfil,
           to_char(s.criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia,
           EXISTS (SELECT 1 FROM aviso_visto v WHERE v.usuario_id = ${eu}::uuid AND v.suporte_id = s.id) AS visto
      FROM pedido_suporte s JOIN usuario u ON u.id = s.usuario_id
     WHERE s.estado = 'aberto' AND s.usuario_id <> ${eu}::uuid
     ORDER BY s.criado_em DESC LIMIT 50`;
  return linhas.map((l) => ({
    ...l,
    assunto_rotulo: ROTULO_ASSUNTO[l.assunto as (typeof ASSUNTOS_SUPORTE)[number]],
    tipo: 'suporte_aberto',
  }));
}
