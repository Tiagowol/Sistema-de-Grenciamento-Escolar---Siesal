import { registrarAuditoria } from '../auditoria/auditoria.js';
import { type ClienteTransacao, withTenant } from '../banco/withTenant.js';
import type { PrismaClient } from '../gerado/prisma/client.js';
import { cifrar, decifrar } from './cifra.js';
import { gerarCodigosRecuperacao, hashCodigo, pareceCodigoRecuperacao } from './codigos.js';
import {
  PERFIS_CADASTRAVEIS,
  type PerfilCadastravel,
  podeAdministrarUsuarios,
} from './politica.js';
import {
  gerarSenhaProvisoria,
  hashSenha,
  validarSenha,
  verificarSenha,
  verificarSenhaFalsa,
} from './senha.js';
import {
  DURACAO_CONFIGURAR_TOTP_SEGUNDOS,
  DURACAO_SESSAO_SEGUNDOS,
  gerarToken,
  lerToken,
} from './sessao.js';
import { base32Codificar, gerarSegredoTotp, passoDe, uriOtpauth, verificarTotp } from './totp.js';

export const MAX_FALHAS = 5;
export const BLOQUEIO_MINUTOS = 15;
export const MENSAGEM_FALHA = 'Credenciais inválidas ou conta temporariamente bloqueada.';

export type Nivel = 'completo' | 'configurar_totp' | 'trocar_senha';
export type SessaoAtiva = {
  sessaoId: string;
  instituicaoId: string;
  usuarioId: string;
  nivel: Nivel;
  perfil: string;
  nome: string;
};
export type ResultadoLogin =
  | {
      tipo: 'ok';
      token: string;
      duracao: number;
      nivel: Nivel;
      usuario: { id: string; nome: string; perfil: string };
    }
  | { tipo: 'segundo_fator_necessario' }
  | { tipo: 'falha' };

type Cred = NonNullable<Awaited<ReturnType<ClienteTransacao['credencial']['findFirst']>>>;

export type Dependencias = {
  banco: PrismaClient;
  chaveTotp: Buffer; // derivada de AUTH_SECRET (cifra.ts)
  agora?: () => Date; // relógio injetável para testes
  emissorTotp?: string;
};

// Serviço de autenticação própria (plano B da ADR-004). Toda leitura e escrita passa por withTenant.
export function criarAutenticacao(dep: Dependencias) {
  const relogio = dep.agora ?? (() => new Date());
  const emissor = dep.emissorTotp ?? 'SIESAL';

  const ator = (usuarioId: string) => `usuario:${usuarioId}`;

  // Abre a sessão e devolve o token; o banco guarda só o hash
  async function abrirSessao(
    tx: ClienteTransacao,
    instituicaoId: string,
    usuarioId: string,
    nivel: Nivel,
    agora: Date,
  ) {
    const duracao =
      nivel === 'completo' ? DURACAO_SESSAO_SEGUNDOS : DURACAO_CONFIGURAR_TOTP_SEGUNDOS;
    const { token, hash } = gerarToken(instituicaoId);
    await tx.sessao.create({
      data: {
        instituicao_id: instituicaoId,
        usuario_id: usuarioId,
        token_hash: hash,
        nivel,
        expira_em: new Date(agora.getTime() + duracao * 1000),
      },
    });
    return { token, duracao };
  }

  // Conta uma falha; na quinta seguida bloqueia a conta por 15 minutos. Tudo auditado.
  async function registrarFalha(
    tx: ClienteTransacao,
    cred: Cred,
    motivo: string,
    agora: Date,
  ): Promise<void> {
    const nova = await tx.credencial.update({
      where: {
        instituicao_id_usuario_id: {
          instituicao_id: cred.instituicao_id,
          usuario_id: cred.usuario_id,
        },
      },
      data: { falhas_seguidas: { increment: 1 }, atualizado_em: agora },
    });
    const bloquear = nova.falhas_seguidas >= MAX_FALHAS;
    if (bloquear) {
      await tx.credencial.update({
        where: {
          instituicao_id_usuario_id: {
            instituicao_id: cred.instituicao_id,
            usuario_id: cred.usuario_id,
          },
        },
        data: {
          falhas_seguidas: 0,
          bloqueado_ate: new Date(agora.getTime() + BLOQUEIO_MINUTOS * 60_000),
        },
      });
    }
    await registrarAuditoria(tx, {
      instituicaoId: cred.instituicao_id,
      ator: ator(cred.usuario_id),
      acao: bloquear ? 'auth.conta_bloqueada' : 'auth.login_falhou',
      alvo: ator(cred.usuario_id),
      depois: { motivo },
    });
  }

  // Confere o código TOTP (uma vez por passo) ou um código de recuperação (uma vez cada)
  async function conferirSegundoFator(
    tx: ClienteTransacao,
    cred: Cred,
    codigo: string,
    agora: Date,
  ): Promise<boolean> {
    const chave = { instituicao_id: cred.instituicao_id, usuario_id: cred.usuario_id };
    if (pareceCodigoRecuperacao(codigo)) {
      const usado = await tx.codigoRecuperacao.updateMany({
        where: { ...chave, codigo_hash: hashCodigo(codigo), usado_em: null },
        data: { usado_em: agora },
      });
      if (usado.count === 1) {
        await registrarAuditoria(tx, {
          instituicaoId: cred.instituicao_id,
          ator: ator(cred.usuario_id),
          acao: 'auth.codigo_recuperacao_usado',
          alvo: ator(cred.usuario_id),
        });
      }
      return usado.count === 1;
    }
    if (!cred.totp_segredo_cifrado) return false;
    const segredo = decifrar(cred.totp_segredo_cifrado, dep.chaveTotp);
    const ultimo = cred.totp_ultimo_passo === null ? null : Number(cred.totp_ultimo_passo);
    const passo = verificarTotp(segredo, codigo, agora, ultimo);
    if (passo === null) return false;
    // Atualização condicional: dois pedidos com o mesmo código não passam os dois
    const gravado = await tx.credencial.updateMany({
      where: {
        ...chave,
        OR: [{ totp_ultimo_passo: null }, { totp_ultimo_passo: { lt: BigInt(passo) } }],
      },
      data: { totp_ultimo_passo: BigInt(passo) },
    });
    return gravado.count === 1;
  }

  // Senha provisória: só troca de senha. Administrador sem TOTP: só configura o TOTP. Senão: acesso completo.
  function nivelInicial(perfil: string, cred: Cred): Nivel {
    if (cred.senha_provisoria) return 'trocar_senha';
    return perfil === 'admin' && !cred.totp_ativo ? 'configurar_totp' : 'completo';
  }

  async function login(entrada: {
    instituicaoId: string;
    email: string;
    senha: string;
    codigo?: string;
  }): Promise<ResultadoLogin> {
    const agora = relogio();
    return withTenant(
      dep.banco,
      { instituicaoId: entrada.instituicaoId },
      async (tx): Promise<ResultadoLogin> => {
        // L18: instituição suspensa pelo Master não entra (a RLS só mostra a própria instituição)
        if (!(await tx.instituicao.findFirst({ where: { situacao: 'ativa' } }))) {
          await verificarSenhaFalsa(entrada.senha);
          return { tipo: 'falha' };
        }
        const usuario = await tx.usuario.findFirst({
          where: {
            situacao: 'ativo',
            email: { equals: entrada.email.trim(), mode: 'insensitive' },
          },
        });
        const cred = usuario
          ? await tx.credencial.findUnique({
              where: {
                instituicao_id_usuario_id: {
                  instituicao_id: entrada.instituicaoId,
                  usuario_id: usuario.id,
                },
              },
            })
          : null;
        // Usuário desconhecido: gasta o mesmo tempo de uma conferência real e não revela nada
        if (!usuario || !cred) {
          await verificarSenhaFalsa(entrada.senha);
          await registrarAuditoria(tx, {
            instituicaoId: entrada.instituicaoId,
            ator: 'anonimo',
            acao: 'auth.login_falhou',
            depois: { motivo: 'desconhecido' },
          });
          return { tipo: 'falha' };
        }
        if (cred.bloqueado_ate && cred.bloqueado_ate > agora) {
          await verificarSenhaFalsa(entrada.senha);
          await registrarAuditoria(tx, {
            instituicaoId: entrada.instituicaoId,
            ator: ator(usuario.id),
            acao: 'auth.login_bloqueado',
            alvo: ator(usuario.id),
          });
          return { tipo: 'falha' };
        }
        if (!(await verificarSenha(entrada.senha, cred.senha_hash))) {
          await registrarFalha(tx, cred, 'senha', agora);
          return { tipo: 'falha' };
        }
        if (cred.totp_ativo) {
          if (!entrada.codigo) return { tipo: 'segundo_fator_necessario' };
          if (!(await conferirSegundoFator(tx, cred, entrada.codigo, agora))) {
            await registrarFalha(tx, cred, 'segundo_fator', agora);
            return { tipo: 'falha' };
          }
        }
        await tx.credencial.update({
          where: {
            instituicao_id_usuario_id: {
              instituicao_id: cred.instituicao_id,
              usuario_id: cred.usuario_id,
            },
          },
          data: { falhas_seguidas: 0, bloqueado_ate: null, atualizado_em: agora },
        });
        const nivel = nivelInicial(usuario.perfil, cred);
        const { token, duracao } = await abrirSessao(
          tx,
          entrada.instituicaoId,
          usuario.id,
          nivel,
          agora,
        );
        await registrarAuditoria(tx, {
          instituicaoId: entrada.instituicaoId,
          ator: ator(usuario.id),
          acao: 'auth.login_ok',
          alvo: ator(usuario.id),
          depois: { nivel },
        });
        return {
          tipo: 'ok',
          token,
          duracao,
          nivel,
          usuario: { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil },
        };
      },
    );
  }

  // Procura a sessão pelo hash do token; vencida, revogada ou de usuário inativo = sem sessão
  async function obterSessao(token: string | undefined): Promise<SessaoAtiva | null> {
    const lido = lerToken(token);
    if (!lido) return null;
    const agora = relogio();
    return withTenant(dep.banco, { instituicaoId: lido.instituicaoId }, async (tx) => {
      const sessao = await tx.sessao.findFirst({
        where: { token_hash: lido.hash, revogada_em: null, expira_em: { gt: agora } },
      });
      if (!sessao) return null;
      // L18: sessão aberta antes da suspensão deixa de valer
      if (!(await tx.instituicao.findFirst({ where: { situacao: 'ativa' } }))) return null;
      const usuario = await tx.usuario.findFirst({
        where: { id: sessao.usuario_id, situacao: 'ativo' },
      });
      if (!usuario) return null;
      return {
        sessaoId: sessao.id,
        instituicaoId: sessao.instituicao_id,
        usuarioId: usuario.id,
        nivel: sessao.nivel as Nivel,
        perfil: usuario.perfil,
        nome: usuario.nome,
      };
    });
  }

  async function logout(sessao: SessaoAtiva): Promise<void> {
    await withTenant(dep.banco, { instituicaoId: sessao.instituicaoId }, async (tx) => {
      await tx.sessao.updateMany({
        where: { id: sessao.sessaoId, revogada_em: null },
        data: { revogada_em: relogio() },
      });
      await registrarAuditoria(tx, {
        instituicaoId: sessao.instituicaoId,
        ator: ator(sessao.usuarioId),
        acao: 'auth.logout',
        alvo: ator(sessao.usuarioId),
      });
    });
  }

  const chaveCred = (s: SessaoAtiva) => ({
    instituicao_id_usuario_id: { instituicao_id: s.instituicaoId, usuario_id: s.usuarioId },
  });

  // Passo 1 do TOTP: cria um segredo novo (ainda inativo) e devolve o que o app autenticador precisa
  async function iniciarTotp(
    sessao: SessaoAtiva,
  ): Promise<{ tipo: 'ok'; segredo: string; uri: string } | { tipo: 'ja_ativo' }> {
    return withTenant(dep.banco, { instituicaoId: sessao.instituicaoId }, async (tx) => {
      const cred = await tx.credencial.findUnique({ where: chaveCred(sessao) });
      if (!cred || cred.totp_ativo) return { tipo: 'ja_ativo' as const };
      const segredo = gerarSegredoTotp();
      await tx.credencial.update({
        where: chaveCred(sessao),
        data: { totp_segredo_cifrado: cifrar(segredo, dep.chaveTotp), atualizado_em: relogio() },
      });
      await registrarAuditoria(tx, {
        instituicaoId: sessao.instituicaoId,
        ator: ator(sessao.usuarioId),
        acao: 'auth.totp_iniciado',
        alvo: ator(sessao.usuarioId),
      });
      const usuario = await tx.usuario.findFirst({ where: { id: sessao.usuarioId } });
      return {
        tipo: 'ok' as const,
        segredo: base32Codificar(segredo),
        uri: uriOtpauth(emissor, usuario?.email ?? sessao.usuarioId, segredo),
      };
    });
  }

  // Passo 2: confere o primeiro código, ativa o TOTP, gera os códigos de recuperação e troca a sessão
  async function confirmarTotp(
    sessao: SessaoAtiva,
    codigo: string,
  ): Promise<
    | { tipo: 'ok'; codigosRecuperacao: string[]; token: string; duracao: number }
    | { tipo: 'ja_ativo' }
    | { tipo: 'nao_iniciado' }
    | { tipo: 'codigo_invalido' }
  > {
    const agora = relogio();
    return withTenant(dep.banco, { instituicaoId: sessao.instituicaoId }, async (tx) => {
      const cred = await tx.credencial.findUnique({ where: chaveCred(sessao) });
      if (!cred || cred.totp_ativo) return { tipo: 'ja_ativo' as const };
      if (!cred.totp_segredo_cifrado) return { tipo: 'nao_iniciado' as const };
      if (cred.bloqueado_ate && cred.bloqueado_ate > agora)
        return { tipo: 'codigo_invalido' as const };
      const passo = verificarTotp(
        decifrar(cred.totp_segredo_cifrado, dep.chaveTotp),
        codigo,
        agora,
        null,
      );
      if (passo === null) {
        await registrarFalha(tx, cred, 'totp_confirmacao', agora);
        return { tipo: 'codigo_invalido' as const };
      }
      const chave = { instituicao_id: sessao.instituicaoId, usuario_id: sessao.usuarioId };
      await tx.credencial.update({
        where: chaveCred(sessao),
        data: {
          totp_ativo: true,
          totp_ultimo_passo: BigInt(passo),
          falhas_seguidas: 0,
          atualizado_em: agora,
        },
      });
      // Códigos antigos deixam de valer; nada é apagado
      await tx.codigoRecuperacao.updateMany({
        where: { ...chave, usado_em: null },
        data: { usado_em: agora },
      });
      const codigos = gerarCodigosRecuperacao();
      await tx.codigoRecuperacao.createMany({
        data: codigos.map((c) => ({ ...chave, codigo_hash: c.hash })),
      });
      // A sessão limitada é encerrada e nasce uma completa (token novo)
      await tx.sessao.updateMany({
        where: { id: sessao.sessaoId, revogada_em: null },
        data: { revogada_em: agora },
      });
      const nova = await abrirSessao(tx, sessao.instituicaoId, sessao.usuarioId, 'completo', agora);
      await registrarAuditoria(tx, {
        instituicaoId: sessao.instituicaoId,
        ator: ator(sessao.usuarioId),
        acao: 'auth.totp_ativado',
        alvo: ator(sessao.usuarioId),
      });
      return {
        tipo: 'ok' as const,
        codigosRecuperacao: codigos.map((c) => c.texto),
        token: nova.token,
        duracao: nova.duracao,
      };
    });
  }

  // Troca a senha (obrigatória com senha provisória). Encerra todas as sessões do usuário e abre uma nova.
  async function trocarSenha(
    sessao: SessaoAtiva,
    senhaAtual: string,
    senhaNova: string,
  ): Promise<
    | { tipo: 'ok'; token: string; duracao: number; nivel: Nivel }
    | { tipo: 'senha_fraca'; mensagem: string }
    | { tipo: 'senha_atual_invalida' }
    | { tipo: 'senha_igual' }
  > {
    const agora = relogio();
    const fraca = validarSenha(senhaNova);
    if (fraca) return { tipo: 'senha_fraca', mensagem: fraca };
    if (senhaNova === senhaAtual) return { tipo: 'senha_igual' };
    return withTenant(dep.banco, { instituicaoId: sessao.instituicaoId }, async (tx) => {
      const cred = await tx.credencial.findUnique({ where: chaveCred(sessao) });
      if (!cred) return { tipo: 'senha_atual_invalida' as const };
      if (cred.bloqueado_ate && cred.bloqueado_ate > agora) {
        await verificarSenhaFalsa(senhaAtual);
        return { tipo: 'senha_atual_invalida' as const };
      }
      if (!(await verificarSenha(senhaAtual, cred.senha_hash))) {
        await registrarFalha(tx, cred, 'troca_senha', agora);
        return { tipo: 'senha_atual_invalida' as const };
      }
      const atualizada = await tx.credencial.update({
        where: chaveCred(sessao),
        data: {
          senha_hash: await hashSenha(senhaNova),
          senha_provisoria: false,
          falhas_seguidas: 0,
          bloqueado_ate: null,
          atualizado_em: agora,
        },
      });
      await tx.sessao.updateMany({
        where: { usuario_id: sessao.usuarioId, revogada_em: null },
        data: { revogada_em: agora },
      });
      const nivel = nivelInicial(sessao.perfil, atualizada);
      const nova = await abrirSessao(tx, sessao.instituicaoId, sessao.usuarioId, nivel, agora);
      await registrarAuditoria(tx, {
        instituicaoId: sessao.instituicaoId,
        ator: ator(sessao.usuarioId),
        acao: 'auth.senha_trocada',
        alvo: ator(sessao.usuarioId),
      });
      return { tipo: 'ok' as const, token: nova.token, duracao: nova.duracao, nivel };
    });
  }

  // Lista os usuários da própria instituição (só admin). Nunca devolve hash, segredo ou código.
  async function listarUsuarios(sessao: SessaoAtiva): Promise<
    | {
        tipo: 'ok';
        usuarios: {
          id: string;
          perfil: string;
          nome: string;
          email: string;
          situacao: string;
          senhaProvisoria: boolean;
        }[];
      }
    | { tipo: 'proibido' }
  > {
    if (sessao.nivel !== 'completo' || !podeAdministrarUsuarios(sessao.perfil)) {
      await negarAcesso(sessao, 'usuario.listagem_negada');
      return { tipo: 'proibido' };
    }
    return withTenant(dep.banco, { instituicaoId: sessao.instituicaoId }, async (tx) => {
      // Conta encerrada (L17c) não aparece na lista
      const linhas = await tx.usuario.findMany({
        where: { encerrada_em: null },
        orderBy: [{ perfil: 'asc' }, { nome: 'asc' }],
      });
      const provisorias = await tx.credencial.findMany({
        where: { senha_provisoria: true },
        select: { usuario_id: true },
      });
      const marcados = new Set(provisorias.map((c) => c.usuario_id));
      return {
        tipo: 'ok' as const,
        usuarios: linhas.map((u) => ({
          id: u.id,
          perfil: u.perfil,
          nome: u.nome,
          email: u.email,
          situacao: u.situacao,
          senhaProvisoria: marcados.has(u.id),
        })),
      };
    });
  }

  // Tentativa sem permissão também fica na auditoria
  async function negarAcesso(sessao: SessaoAtiva, acao: string): Promise<void> {
    await withTenant(dep.banco, { instituicaoId: sessao.instituicaoId }, (tx) =>
      registrarAuditoria(tx, {
        instituicaoId: sessao.instituicaoId,
        ator: ator(sessao.usuarioId),
        acao,
        alvo: ator(sessao.usuarioId),
      }),
    );
  }

  // Admin cria usuário da própria instituição com senha provisória (mostrada uma vez, nunca gravada em claro)
  async function criarUsuario(
    sessao: SessaoAtiva,
    dados: { perfil: PerfilCadastravel; nome: string; email: string },
  ): Promise<
    | {
        tipo: 'ok';
        usuario: { id: string; perfil: string; nome: string; email: string };
        senhaProvisoria: string;
      }
    | { tipo: 'proibido' }
    | { tipo: 'email_em_uso' }
  > {
    if (
      sessao.nivel !== 'completo' ||
      !podeAdministrarUsuarios(sessao.perfil) ||
      !PERFIS_CADASTRAVEIS.includes(dados.perfil)
    ) {
      await negarAcesso(sessao, 'usuario.criacao_negada');
      return { tipo: 'proibido' };
    }
    const email = dados.email.trim().toLowerCase();
    const senhaProvisoria = gerarSenhaProvisoria();
    const senhaHash = await hashSenha(senhaProvisoria);
    const agora = relogio();
    try {
      return await withTenant(dep.banco, { instituicaoId: sessao.instituicaoId }, async (tx) => {
        const existente = await tx.usuario.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });
        if (existente) return { tipo: 'email_em_uso' as const };
        const usuario = await tx.usuario.create({
          data: {
            instituicao_id: sessao.instituicaoId,
            perfil: dados.perfil,
            nome: dados.nome.trim(),
            email,
          },
        });
        await tx.credencial.create({
          data: {
            instituicao_id: sessao.instituicaoId,
            usuario_id: usuario.id,
            senha_hash: senhaHash,
            senha_provisoria: true,
            atualizado_em: agora,
          },
        });
        await registrarAuditoria(tx, {
          instituicaoId: sessao.instituicaoId,
          ator: ator(sessao.usuarioId),
          acao: 'usuario.criado',
          alvo: ator(usuario.id),
          depois: { perfil: usuario.perfil },
        });
        return {
          tipo: 'ok' as const,
          usuario: {
            id: usuario.id,
            perfil: usuario.perfil,
            nome: usuario.nome,
            email: usuario.email,
          },
          senhaProvisoria,
        };
      });
    } catch (erro) {
      // Corrida entre dois cadastros do mesmo e-mail: a restrição única do banco decide
      if (
        typeof erro === 'object' &&
        erro !== null &&
        (erro as { code?: string }).code === 'P2002'
      ) {
        return { tipo: 'email_em_uso' };
      }
      throw erro;
    }
  }

  // Admin gera nova senha provisória para um usuário da própria instituição (esquecimento ou bloqueio)
  async function redefinirSenha(
    sessao: SessaoAtiva,
    usuarioId: string,
  ): Promise<
    { tipo: 'ok'; senhaProvisoria: string } | { tipo: 'proibido' } | { tipo: 'nao_encontrado' }
  > {
    if (sessao.nivel !== 'completo' || !podeAdministrarUsuarios(sessao.perfil)) {
      await negarAcesso(sessao, 'usuario.redefinicao_negada');
      return { tipo: 'proibido' };
    }
    const senhaProvisoria = gerarSenhaProvisoria();
    const senhaHash = await hashSenha(senhaProvisoria);
    const agora = relogio();
    return withTenant(dep.banco, { instituicaoId: sessao.instituicaoId }, async (tx) => {
      const alvo = await tx.credencial.findFirst({ where: { usuario_id: usuarioId } });
      if (!alvo) return { tipo: 'nao_encontrado' as const };
      await tx.credencial.update({
        where: {
          instituicao_id_usuario_id: {
            instituicao_id: alvo.instituicao_id,
            usuario_id: alvo.usuario_id,
          },
        },
        data: {
          senha_hash: senhaHash,
          senha_provisoria: true,
          falhas_seguidas: 0,
          bloqueado_ate: null,
          atualizado_em: agora,
        },
      });
      await tx.sessao.updateMany({
        where: { usuario_id: usuarioId, revogada_em: null },
        data: { revogada_em: agora },
      });
      await registrarAuditoria(tx, {
        instituicaoId: sessao.instituicaoId,
        ator: ator(sessao.usuarioId),
        acao: 'usuario.senha_redefinida',
        alvo: ator(usuarioId),
      });
      return { tipo: 'ok' as const, senhaProvisoria };
    });
  }

  return {
    login,
    obterSessao,
    logout,
    iniciarTotp,
    confirmarTotp,
    trocarSenha,
    criarUsuario,
    redefinirSenha,
    listarUsuarios,
    passoAtual: () => passoDe(relogio()),
  };
}

export type Autenticacao = ReturnType<typeof criarAutenticacao>;
