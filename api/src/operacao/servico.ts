import { createHash, randomBytes } from 'node:crypto';
import { mascarar } from '../auditoria/auditoria.js';
import { cifrar, decifrar } from '../auth/cifra.js';
import { gerarCodigoDeConvite, hashDoCodigo } from '../auth/convite-individual.js';
import { hashSenha, validarSenha, verificarSenha, verificarSenhaFalsa } from '../auth/senha.js';
import { base32Codificar, gerarSegredoTotp, uriOtpauth, verificarTotp } from '../auth/totp.js';
import type { ClienteTransacao } from '../banco/withTenant.js';
import type { PrismaClient } from '../gerado/prisma/client.js';
import { type EstadoModulos, MODULOS, type Modulo } from '../modulos.js';

// Login e painel mínimo dos Masters (L18). Tudo roda como o papel siesal_ops, que não tem
// nenhuma permissão em tabela escolar. Nenhuma função daqui usa withTenant.
export const MAX_FALHAS_OPERACAO = 5;
export const BLOQUEIO_OPERACAO_MINUTOS = 15;
export const DURACAO_OPERACAO_SEGUNDOS = 60 * 60;
export const DURACAO_OPERACAO_TOTP_SEGUNDOS = 15 * 60;
export const FALHA_OPERACAO = 'Dados incorretos ou conta temporariamente bloqueada.';

export type NivelOperacao = 'completo' | 'configurar_totp';
export type SessaoOperacao = {
  sessaoId: string;
  operadorId: string;
  usuario: string;
  nivel: NivelOperacao;
};
export type InstituicaoLista = { id: string; nome: string; situacao: string; criado_em: Date };
// L20: situações da instituição e módulos que o Master liga e desliga
export const SITUACOES = ['em_implantacao', 'ativa', 'suspensa', 'encerrada'] as const;
export type Situacao = (typeof SITUACOES)[number];
export type PainelInstituicao = InstituicaoLista & {
  modulos: EstadoModulos;
  contagem: Record<string, number>; // perfil -> usuários ativos (só números)
};
type Entrada =
  | { tipo: 'ok'; token: string; duracao: number; nivel: NivelOperacao; usuario: string }
  | { tipo: 'falha' };

type Conta = {
  id: string;
  usuario: string;
  senha_hash: string | null;
  situacao: string;
  totp_segredo_cifrado: string | null;
  totp_ativo: boolean;
  totp_ultimo_passo: bigint | null;
  bloqueado_ate: Date | null;
  convite_hash: string | null;
  convite_expira_em: Date | null;
};

// Única porta do Master ao banco: troca de papel só dentro da transação (acaba no COMMIT ou ROLLBACK)
export async function comoOperacao<T>(
  banco: Pick<PrismaClient, '$transaction'>,
  funcao: (tx: ClienteTransacao) => Promise<T>,
): Promise<T> {
  return banco.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE siesal_ops`;
    return funcao(tx);
  });
}

export const hashOperacao = (texto: string) => createHash('sha256').update(texto).digest('hex');
// O convite é comparado sem diferença de maiúsculas, espaços ou traços
export const normalizarConvite = (texto: string) => texto.toUpperCase().replace(/[^A-Z0-9]/g, '');

export type DependenciasOperacao = {
  banco: PrismaClient;
  chaveTotp: Buffer;
  agora?: () => Date;
};

export function criarOperacao(dep: DependenciasOperacao) {
  const relogio = dep.agora ?? (() => new Date());

  // Grava na trilha do Master. Campos sensíveis viram "***" (mesma regra da auditoria escolar).
  async function auditar(
    tx: ClienteTransacao,
    ator: string,
    acao: string,
    alvo = '',
    detalhe?: unknown,
  ): Promise<void> {
    const json = detalhe === undefined ? null : JSON.stringify(mascarar(detalhe));
    await tx.$executeRaw`INSERT INTO operator_auditoria (ator, acao, alvo, detalhe)
      VALUES (${ator}, ${acao}, ${alvo}, ${json}::jsonb)`;
  }

  async function buscarConta(tx: ClienteTransacao, usuario: string): Promise<Conta | null> {
    const linhas = await tx.$queryRaw<Conta[]>`
      SELECT id, usuario, senha_hash, situacao, totp_segredo_cifrado, totp_ativo, totp_ultimo_passo,
             bloqueado_ate, convite_hash, convite_expira_em
        FROM operator_account
       WHERE lower(usuario) = ${usuario.trim().toLowerCase()} AND situacao IN ('pendente', 'ativo')`;
    return linhas[0] ?? null;
  }

  async function abrirSessao(
    tx: ClienteTransacao,
    operadorId: string,
    nivel: NivelOperacao,
    agora: Date,
  ) {
    const duracao =
      nivel === 'completo' ? DURACAO_OPERACAO_SEGUNDOS : DURACAO_OPERACAO_TOTP_SEGUNDOS;
    const token = randomBytes(32).toString('base64url');
    const expira = new Date(agora.getTime() + duracao * 1000);
    await tx.$executeRaw`INSERT INTO operator_sessao (operador_id, token_hash, nivel, expira_em)
      VALUES (${operadorId}::uuid, ${hashOperacao(token)}, ${nivel}, ${expira})`;
    return { token, duracao };
  }

  const revogarSessoes = (tx: ClienteTransacao, operadorId: string, agora: Date) =>
    tx.$executeRaw`UPDATE operator_sessao SET revogada_em = ${agora}
      WHERE operador_id = ${operadorId}::uuid AND revogada_em IS NULL`;

  // Conta uma falha; na quinta seguida bloqueia por 15 minutos. Tudo auditado.
  async function registrarFalha(tx: ClienteTransacao, conta: Conta, motivo: string, agora: Date) {
    const linhas = await tx.$queryRaw<{ falhas_seguidas: number }[]>`
      UPDATE operator_account SET falhas_seguidas = falhas_seguidas + 1, atualizado_em = ${agora}
       WHERE id = ${conta.id}::uuid RETURNING falhas_seguidas`;
    const bloquear = (linhas[0]?.falhas_seguidas ?? 0) >= MAX_FALHAS_OPERACAO;
    if (bloquear) {
      const ate = new Date(agora.getTime() + BLOQUEIO_OPERACAO_MINUTOS * 60_000);
      await tx.$executeRaw`UPDATE operator_account SET falhas_seguidas = 0, bloqueado_ate = ${ate}
        WHERE id = ${conta.id}::uuid`;
    }
    await auditar(
      tx,
      `master:${conta.usuario}`,
      bloquear ? 'operacao.conta_bloqueada' : 'operacao.login_falhou',
      '',
      { motivo },
    );
  }

  const bloqueada = (conta: Conta, agora: Date) =>
    conta.bloqueado_ate !== null && conta.bloqueado_ate > agora;

  // Primeiro acesso (ou redefinição): usuário + convite de uso único + senha nova. Depois vem o TOTP.
  async function primeiroAcesso(entrada: {
    usuario: string;
    convite: string;
    senhaNova: string;
  }): Promise<Entrada | { tipo: 'senha_fraca'; mensagem: string }> {
    const fraca = validarSenha(entrada.senhaNova);
    if (fraca) return { tipo: 'senha_fraca', mensagem: fraca };
    const agora = relogio();
    const senhaHash = await hashSenha(entrada.senhaNova);
    return comoOperacao(dep.banco, async (tx): Promise<Entrada> => {
      const conta = await buscarConta(tx, entrada.usuario);
      if (!conta) {
        await auditar(tx, 'anonimo', 'operacao.primeiro_acesso_falhou', '', {
          motivo: 'desconhecido',
        });
        return { tipo: 'falha' };
      }
      if (bloqueada(conta, agora)) {
        await auditar(tx, `master:${conta.usuario}`, 'operacao.login_bloqueado');
        return { tipo: 'falha' };
      }
      const valido =
        conta.convite_hash !== null &&
        conta.convite_expira_em !== null &&
        conta.convite_expira_em > agora &&
        conta.convite_hash === hashOperacao(normalizarConvite(entrada.convite));
      if (!valido) {
        await registrarFalha(tx, conta, 'convite', agora);
        return { tipo: 'falha' };
      }
      // O convite vale uma vez. O TOTP antigo (se havia) deixa de valer: será configurado de novo.
      await tx.$executeRaw`UPDATE operator_account
        SET senha_hash = ${senhaHash}, convite_hash = NULL, convite_expira_em = NULL,
            situacao = 'pendente', totp_ativo = false, totp_segredo_cifrado = NULL,
            totp_ultimo_passo = NULL, falhas_seguidas = 0, bloqueado_ate = NULL, atualizado_em = ${agora}
        WHERE id = ${conta.id}::uuid`;
      await revogarSessoes(tx, conta.id, agora);
      const nova = await abrirSessao(tx, conta.id, 'configurar_totp', agora);
      await auditar(tx, `master:${conta.usuario}`, 'operacao.senha_definida');
      return { tipo: 'ok', ...nova, nivel: 'configurar_totp', usuario: conta.usuario };
    });
  }

  async function login(entrada: {
    usuario: string;
    senha: string;
    codigo?: string;
  }): Promise<Entrada | { tipo: 'segundo_fator_necessario' }> {
    const agora = relogio();
    return comoOperacao(
      dep.banco,
      async (tx): Promise<Entrada | { tipo: 'segundo_fator_necessario' }> => {
        const conta = await buscarConta(tx, entrada.usuario);
        // Usuário desconhecido ou ainda sem senha: gasta o mesmo tempo e não revela nada
        if (!conta?.senha_hash) {
          await verificarSenhaFalsa(entrada.senha);
          await auditar(tx, 'anonimo', 'operacao.login_falhou', '', { motivo: 'desconhecido' });
          return { tipo: 'falha' };
        }
        if (bloqueada(conta, agora)) {
          await verificarSenhaFalsa(entrada.senha);
          await auditar(tx, `master:${conta.usuario}`, 'operacao.login_bloqueado');
          return { tipo: 'falha' };
        }
        if (!(await verificarSenha(entrada.senha, conta.senha_hash))) {
          await registrarFalha(tx, conta, 'senha', agora);
          return { tipo: 'falha' };
        }
        let nivel: NivelOperacao = 'configurar_totp';
        if (conta.totp_ativo && conta.totp_segredo_cifrado) {
          if (!entrada.codigo) return { tipo: 'segundo_fator_necessario' };
          const ultimo = conta.totp_ultimo_passo === null ? null : Number(conta.totp_ultimo_passo);
          const passo = verificarTotp(
            decifrar(conta.totp_segredo_cifrado, dep.chaveTotp),
            entrada.codigo,
            agora,
            ultimo,
          );
          // Atualização condicional: o mesmo código não vale duas vezes
          const gravado =
            passo === null
              ? 0
              : await tx.$executeRaw`UPDATE operator_account SET totp_ultimo_passo = ${BigInt(passo)}
                  WHERE id = ${conta.id}::uuid
                    AND (totp_ultimo_passo IS NULL OR totp_ultimo_passo < ${BigInt(passo)})`;
          if (gravado !== 1) {
            await registrarFalha(tx, conta, 'segundo_fator', agora);
            return { tipo: 'falha' };
          }
          nivel = 'completo';
        }
        await tx.$executeRaw`UPDATE operator_account
          SET falhas_seguidas = 0, bloqueado_ate = NULL, atualizado_em = ${agora}
          WHERE id = ${conta.id}::uuid`;
        const nova = await abrirSessao(tx, conta.id, nivel, agora);
        await auditar(tx, `master:${conta.usuario}`, 'operacao.login_ok', '', { nivel });
        return { tipo: 'ok', ...nova, nivel, usuario: conta.usuario };
      },
    );
  }

  // Sessão vencida, revogada ou de Master inativo = sem sessão
  async function obterSessao(token: string | undefined): Promise<SessaoOperacao | null> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const agora = relogio();
    return comoOperacao(dep.banco, async (tx) => {
      const linhas = await tx.$queryRaw<
        { id: string; operador_id: string; nivel: string; usuario: string }[]
      >`SELECT s.id, s.operador_id, s.nivel, o.usuario
          FROM operator_sessao s JOIN operator_account o ON o.id = s.operador_id
         WHERE s.token_hash = ${hashOperacao(token)} AND s.revogada_em IS NULL
           AND s.expira_em > ${agora} AND o.situacao IN ('pendente', 'ativo')`;
      const s = linhas[0];
      if (!s) return null;
      return {
        sessaoId: s.id,
        operadorId: s.operador_id,
        usuario: s.usuario,
        nivel: s.nivel as NivelOperacao,
      };
    });
  }

  async function logout(sessao: SessaoOperacao): Promise<void> {
    await comoOperacao(dep.banco, async (tx) => {
      await tx.$executeRaw`UPDATE operator_sessao SET revogada_em = ${relogio()}
        WHERE id = ${sessao.sessaoId}::uuid AND revogada_em IS NULL`;
      await auditar(tx, `master:${sessao.usuario}`, 'operacao.logout');
    });
  }

  // Passo 1 do TOTP: cria um segredo novo (ainda inativo)
  async function iniciarTotp(
    sessao: SessaoOperacao,
  ): Promise<{ tipo: 'ok'; segredo: string; uri: string } | { tipo: 'ja_ativo' }> {
    return comoOperacao(dep.banco, async (tx) => {
      const conta = await buscarConta(tx, sessao.usuario);
      if (!conta || conta.totp_ativo) return { tipo: 'ja_ativo' as const };
      const segredo = gerarSegredoTotp();
      await tx.$executeRaw`UPDATE operator_account
        SET totp_segredo_cifrado = ${cifrar(segredo, dep.chaveTotp)}, atualizado_em = ${relogio()}
        WHERE id = ${conta.id}::uuid`;
      await auditar(tx, `master:${conta.usuario}`, 'operacao.totp_iniciado');
      return {
        tipo: 'ok' as const,
        segredo: base32Codificar(segredo),
        uri: uriOtpauth('SIESAL Operação', conta.usuario, segredo),
      };
    });
  }

  // Passo 2: confere o primeiro código, ativa o TOTP e a conta, e troca a sessão por uma completa
  async function confirmarTotp(
    sessao: SessaoOperacao,
    codigo: string,
  ): Promise<
    | { tipo: 'ok'; token: string; duracao: number }
    | { tipo: 'ja_ativo' }
    | { tipo: 'nao_iniciado' }
    | { tipo: 'codigo_invalido' }
  > {
    const agora = relogio();
    return comoOperacao(dep.banco, async (tx) => {
      const conta = await buscarConta(tx, sessao.usuario);
      if (!conta || conta.totp_ativo) return { tipo: 'ja_ativo' as const };
      if (!conta.totp_segredo_cifrado || !conta.senha_hash)
        return { tipo: 'nao_iniciado' as const };
      if (bloqueada(conta, agora)) return { tipo: 'codigo_invalido' as const };
      const passo = verificarTotp(
        decifrar(conta.totp_segredo_cifrado, dep.chaveTotp),
        codigo,
        agora,
        null,
      );
      if (passo === null) {
        await registrarFalha(tx, conta, 'totp_confirmacao', agora);
        return { tipo: 'codigo_invalido' as const };
      }
      await tx.$executeRaw`UPDATE operator_account
        SET totp_ativo = true, totp_ultimo_passo = ${BigInt(passo)}, situacao = 'ativo',
            falhas_seguidas = 0, atualizado_em = ${agora}
        WHERE id = ${conta.id}::uuid`;
      await revogarSessoes(tx, conta.id, agora);
      const nova = await abrirSessao(tx, conta.id, 'completo', agora);
      await auditar(tx, `master:${conta.usuario}`, 'operacao.totp_ativado');
      return { tipo: 'ok' as const, ...nova };
    });
  }

  // Painel mínimo: só a tabela instituicao (nome e situação). Nenhum número ou dado de pessoa.
  async function listarInstituicoes(): Promise<InstituicaoLista[]> {
    return comoOperacao(
      dep.banco,
      (tx) => tx.$queryRaw<InstituicaoLista[]>`
        SELECT id, nome, situacao, criado_em FROM instituicao WHERE tipo = 'escola' ORDER BY criado_em, nome`,
    );
  }

  async function criarInstituicao(sessao: SessaoOperacao, nome: string): Promise<InstituicaoLista> {
    return comoOperacao(dep.banco, async (tx) => {
      const linhas = await tx.$queryRaw<InstituicaoLista[]>`
        INSERT INTO instituicao (nome) VALUES (${nome.trim()}) RETURNING id, nome, situacao, criado_em`;
      const nova = linhas[0] as InstituicaoLista;
      await auditar(
        tx,
        `master:${sessao.usuario}`,
        'instituicao.criada',
        `instituicao:${nova.id}`,
        {
          nome: nova.nome,
        },
      );
      return nova;
    });
  }

  // Muda só a situação (L18: suspender e reativar; L20: as 4 situações). Nada se apaga.
  // Encerrar pede o nome da instituição escrito igual (segundo passo da confirmação).
  const ACAO_DA_SITUACAO: Record<Situacao, string> = {
    em_implantacao: 'instituicao.em_implantacao',
    ativa: 'instituicao.reativada',
    suspensa: 'instituicao.suspensa',
    encerrada: 'instituicao.encerrada',
  };
  async function mudarSituacao(
    sessao: SessaoOperacao,
    id: string,
    situacao: Situacao,
    confirmarNome?: string,
  ): Promise<'ok' | 'nao_encontrada' | 'sem_mudanca' | 'confirmacao'> {
    return comoOperacao(dep.banco, async (tx) => {
      const atual = await tx.$queryRaw<{ situacao: string; nome: string }[]>`
        SELECT situacao, nome FROM instituicao WHERE id = ${id}::uuid AND tipo = 'escola' FOR UPDATE`;
      if (!atual[0]) return 'nao_encontrada';
      if (atual[0].situacao === situacao) return 'sem_mudanca';
      if (situacao === 'encerrada' && confirmarNome?.trim() !== atual[0].nome) return 'confirmacao';
      await tx.$executeRaw`UPDATE instituicao SET situacao = ${situacao} WHERE id = ${id}::uuid`;
      await auditar(
        tx,
        `master:${sessao.usuario}`,
        ACAO_DA_SITUACAO[situacao],
        `instituicao:${id}`,
        {
          de: atual[0].situacao,
          para: situacao,
        },
      );
      return 'ok';
    });
  }

  // Painel (L20): instituições com módulos e contagens por perfil. As contagens vêm da função do banco,
  // que devolve só números; o siesal_ops continua sem ler a tabela usuario.
  async function painel(): Promise<PainelInstituicao[]> {
    return comoOperacao(dep.banco, async (tx) => {
      const insts = await tx.$queryRaw<InstituicaoLista[]>`
        SELECT id, nome, situacao, criado_em FROM instituicao WHERE tipo = 'escola' ORDER BY criado_em, nome`;
      const ids = insts.map((i) => i.id);
      const modulos = await tx.$queryRaw<
        { instituicao_id: string; modulo: Modulo; ligado: boolean }[]
      >`
        SELECT instituicao_id, modulo, ligado FROM instituicao_modulo`;
      const contagens = ids.length
        ? await tx.$queryRaw<{ instituicao_id: string; perfil: string; total: number }[]>`
            SELECT instituicao_id, perfil, total FROM contagem_por_perfil(${ids}::uuid[])`
        : [];
      return insts.map((i) => {
        const estado = Object.fromEntries(MODULOS.map((m) => [m, true])) as EstadoModulos;
        for (const m of modulos) if (m.instituicao_id === i.id) estado[m.modulo] = m.ligado;
        const contagem: Record<string, number> = {};
        for (const c of contagens) if (c.instituicao_id === i.id) contagem[c.perfil] = c.total;
        return { ...i, modulos: estado, contagem };
      });
    });
  }

  // Só um número: quantos espaços individuais têm alguém ativo. Nunca nome, e-mail, CPF ou conteúdo.
  async function contarEspacosIndividuais(): Promise<number> {
    return comoOperacao(dep.banco, async (tx) => {
      const [c] = await tx.$queryRaw<{ n: number }[]>`SELECT espaco_individual_contar() AS n`;
      return c?.n ?? 0;
    });
  }

  // Convite de espaço individual (20c-1): o código aparece uma vez, aqui na resposta; no banco fica só o hash
  async function gerarConviteIndividual(
    sessao: SessaoOperacao,
  ): Promise<{ codigo: string; expira_em: Date }> {
    const codigo = gerarCodigoDeConvite();
    return comoOperacao(dep.banco, async (tx) => {
      const [c] = await tx.$queryRaw<{ id: string; expira_em: Date }[]>`
        INSERT INTO convite_individual (codigo_hash, criado_por)
        VALUES (${hashDoCodigo(codigo)}, ${`master:${sessao.usuario}`}) RETURNING id, expira_em`;
      await auditar(
        tx,
        `master:${sessao.usuario}`,
        'convite_individual.criado',
        `convite:${c?.id}`,
      );
      return { codigo, expira_em: (c as { expira_em: Date }).expira_em };
    });
  }
  // Só números: nunca o código nem quem usou
  async function resumoDosConvites(): Promise<{
    pendentes: number;
    usados: number;
    vencidos: number;
  }> {
    return comoOperacao(dep.banco, async (tx) => {
      const [r] = await tx.$queryRaw<{ pendentes: number; usados: number; vencidos: number }[]>`
        SELECT count(*) FILTER (WHERE usado_em IS NULL AND expira_em > now())::int AS pendentes,
               count(*) FILTER (WHERE usado_em IS NOT NULL)::int AS usados,
               count(*) FILTER (WHERE usado_em IS NULL AND expira_em <= now())::int AS vencidos
          FROM convite_individual`;
      return r ?? { pendentes: 0, usados: 0, vencidos: 0 };
    });
  }

  async function mudarModulo(
    sessao: SessaoOperacao,
    id: string,
    modulo: Modulo,
    ligado: boolean,
  ): Promise<'ok' | 'nao_encontrada'> {
    return comoOperacao(dep.banco, async (tx) => {
      const existe = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM instituicao WHERE id = ${id}::uuid AND tipo = 'escola'`;
      if (!existe[0]) return 'nao_encontrada';
      await tx.$executeRaw`
        INSERT INTO instituicao_modulo (instituicao_id, modulo, ligado) VALUES (${id}::uuid, ${modulo}, ${ligado})
        ON CONFLICT (instituicao_id, modulo) DO UPDATE SET ligado = EXCLUDED.ligado, atualizado_em = now()`;
      await auditar(
        tx,
        `master:${sessao.usuario}`,
        ligado ? 'modulo.ligado' : 'modulo.desligado',
        `instituicao:${id}`,
        { modulo },
      );
      return 'ok';
    });
  }

  // Trilha do Master (últimos 100 eventos) e conferência da cadeia de hash
  async function trilha() {
    return comoOperacao(dep.banco, async (tx) => ({
      eventos: await tx.$queryRaw<
        { seq: bigint; ator: string; acao: string; alvo: string; criado_em: Date }[]
      >`SELECT seq, ator, acao, alvo, criado_em FROM operator_auditoria ORDER BY seq DESC LIMIT 100`,
      problemas: (
        await tx.$queryRaw<
          { evento_id: bigint }[]
        >`SELECT evento_id FROM operator_auditoria_verificar()`
      ).length,
    }));
  }

  return {
    primeiroAcesso,
    login,
    obterSessao,
    logout,
    iniciarTotp,
    confirmarTotp,
    listarInstituicoes,
    contarEspacosIndividuais,
    gerarConviteIndividual,
    resumoDosConvites,
    criarInstituicao,
    mudarSituacao,
    painel,
    mudarModulo,
    trilha,
  };
}

export type Operacao = ReturnType<typeof criarOperacao>;
