import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { type ConfigCookie, cookieDeSaida, lerCookie, serializarCookie } from '../auth/sessao.js';
import type { PrismaClient } from '../gerado/prisma/client.js';
import { MODULOS } from '../modulos.js';
import {
  criarOperacao,
  FALHA_OPERACAO,
  type NivelOperacao,
  type SessaoOperacao,
  SITUACOES,
} from './servico.js';

// Cookie próprio do Master: nunca é o cookie da escola, e a sessão escolar não vale aqui
export const COOKIE_OPERACAO: ConfigCookie = { nome: '__Host-siesal_operacao', seguro: true };
export const COOKIE_OPERACAO_LOCAL: ConfigCookie = { nome: 'siesal_operacao', seguro: false };

const usuario = z.string().trim().min(3).max(32);
const corpoLogin = z.strictObject({
  usuario,
  senha: z.string().min(1).max(128),
  codigo: z.string().min(6).max(6).optional(),
});
const corpoPrimeiroAcesso = z.strictObject({
  usuario,
  convite: z.string().min(8).max(40),
  senha_nova: z.string().min(1).max(200),
});
const corpoCodigo = z.strictObject({ codigo: z.string().min(6).max(6) });
const corpoInstituicao = z.strictObject({ nome: z.string().trim().min(1).max(120) });
const parametroId = z.strictObject({ id: z.uuid() });
const corpoSituacao = z.strictObject({
  situacao: z.enum(SITUACOES),
  confirmar_nome: z.string().max(120).optional(),
});
const corpoModulo = z.strictObject({ modulo: z.enum(MODULOS), ligado: z.boolean() });

export type OpcoesOperacao = {
  banco: PrismaClient;
  chaveTotp: Buffer;
  agora?: () => Date;
  cookieLocal: boolean;
  limitar: (requisicao: FastifyRequest, resposta: FastifyReply) => boolean;
};

// Rotas /operacao/* (L18): login dos Masters e painel mínimo de instituições
export function registrarOperacao(app: FastifyInstance, opcoes: OpcoesOperacao): void {
  const ops = criarOperacao({
    banco: opcoes.banco,
    chaveTotp: opcoes.chaveTotp,
    agora: opcoes.agora,
  });
  const cookie = opcoes.cookieLocal ? COOKIE_OPERACAO_LOCAL : COOKIE_OPERACAO;

  // Sessão de Master válida e no nível pedido; qualquer outra coisa é negada
  const exigir = async (
    requisicao: FastifyRequest,
    resposta: FastifyReply,
    niveis: NivelOperacao[] = ['completo'],
  ): Promise<SessaoOperacao | null> => {
    const sessao = await ops.obterSessao(lerCookie(requisicao.headers.cookie, cookie.nome));
    if (!sessao) {
      void resposta.code(401).send({ erro: 'Sessão inválida ou vencida.' });
      return null;
    }
    if (!niveis.includes(sessao.nivel)) {
      void resposta
        .code(403)
        .send({ erro: 'Ative o segundo fator antes de continuar.', nivel: sessao.nivel });
      return null;
    }
    return sessao;
  };

  app.post('/operacao/login', async (requisicao, resposta) => {
    if (!opcoes.limitar(requisicao, resposta)) return resposta;
    const corpo = corpoLogin.safeParse(requisicao.body);
    if (!corpo.success) return resposta.code(400).send({ erro: 'Dados inválidos.' });
    const r = await ops.login(corpo.data);
    if (r.tipo === 'segundo_fator_necessario')
      return resposta.code(401).send({ erro: 'segundo_fator_necessario' });
    if (r.tipo === 'falha') return resposta.code(401).send({ erro: FALHA_OPERACAO });
    return resposta
      .header('set-cookie', serializarCookie(r.token, r.duracao, cookie))
      .send({ nivel: r.nivel, usuario: r.usuario });
  });

  app.post('/operacao/primeiro-acesso', async (requisicao, resposta) => {
    if (!opcoes.limitar(requisicao, resposta)) return resposta;
    const corpo = corpoPrimeiroAcesso.safeParse(requisicao.body);
    if (!corpo.success) return resposta.code(400).send({ erro: 'Dados inválidos.' });
    const r = await ops.primeiroAcesso({
      usuario: corpo.data.usuario,
      convite: corpo.data.convite,
      senhaNova: corpo.data.senha_nova,
    });
    if (r.tipo === 'senha_fraca') return resposta.code(400).send({ erro: r.mensagem });
    if (r.tipo === 'falha') return resposta.code(401).send({ erro: FALHA_OPERACAO });
    return resposta
      .header('set-cookie', serializarCookie(r.token, r.duracao, cookie))
      .send({ nivel: r.nivel, usuario: r.usuario });
  });

  app.get('/operacao/eu', async (requisicao, resposta) => {
    const sessao = await exigir(requisicao, resposta, ['completo', 'configurar_totp']);
    if (!sessao) return resposta;
    return { nivel: sessao.nivel, usuario: sessao.usuario };
  });

  app.post('/operacao/logout', async (requisicao, resposta) => {
    const sessao = await exigir(requisicao, resposta, ['completo', 'configurar_totp']);
    if (!sessao) return resposta;
    await ops.logout(sessao);
    return resposta.header('set-cookie', cookieDeSaida(cookie)).code(204).send();
  });

  app.post('/operacao/totp/iniciar', async (requisicao, resposta) => {
    const sessao = await exigir(requisicao, resposta, ['configurar_totp']);
    if (!sessao) return resposta;
    const r = await ops.iniciarTotp(sessao);
    if (r.tipo === 'ja_ativo') return resposta.code(409).send({ erro: 'O TOTP já está ativo.' });
    return { segredo: r.segredo, uri: r.uri };
  });

  app.post('/operacao/totp/confirmar', async (requisicao, resposta) => {
    if (!opcoes.limitar(requisicao, resposta)) return resposta;
    const sessao = await exigir(requisicao, resposta, ['configurar_totp']);
    if (!sessao) return resposta;
    const corpo = corpoCodigo.safeParse(requisicao.body);
    if (!corpo.success) return resposta.code(400).send({ erro: 'Dados inválidos.' });
    const r = await ops.confirmarTotp(sessao, corpo.data.codigo);
    if (r.tipo === 'ja_ativo') return resposta.code(409).send({ erro: 'O TOTP já está ativo.' });
    if (r.tipo === 'nao_iniciado')
      return resposta.code(409).send({ erro: 'Inicie o TOTP antes de confirmar.' });
    if (r.tipo === 'codigo_invalido') return resposta.code(401).send({ erro: 'Código inválido.' });
    return resposta
      .header('set-cookie', serializarCookie(r.token, r.duracao, cookie))
      .send({ nivel: 'completo' });
  });

  app.get('/operacao/instituicoes', async (requisicao, resposta) => {
    const sessao = await exigir(requisicao, resposta);
    if (!sessao) return resposta;
    return { instituicoes: await ops.listarInstituicoes() };
  });

  app.post('/operacao/instituicoes', async (requisicao, resposta) => {
    const sessao = await exigir(requisicao, resposta);
    if (!sessao) return resposta;
    const corpo = corpoInstituicao.safeParse(requisicao.body);
    if (!corpo.success) return resposta.code(400).send({ erro: 'Escreva o nome da instituição.' });
    return resposta
      .code(201)
      .send({ instituicao: await ops.criarInstituicao(sessao, corpo.data.nome) });
  });

  // L20: painel com módulos e contagens (só números), trilha do Master, situação e módulos
  app.get('/operacao/painel', async (requisicao, resposta) => {
    const sessao = await exigir(requisicao, resposta);
    if (!sessao) return resposta;
    return { instituicoes: await ops.painel() };
  });

  app.get('/operacao/auditoria', async (requisicao, resposta) => {
    const sessao = await exigir(requisicao, resposta);
    if (!sessao) return resposta;
    const t = await ops.trilha();
    return {
      integra: t.problemas === 0,
      eventos: t.eventos.map((e) => ({ ...e, seq: Number(e.seq) })),
    };
  });

  app.post('/operacao/instituicoes/:id/situacao', async (requisicao, resposta) => {
    const sessao = await exigir(requisicao, resposta);
    if (!sessao) return resposta;
    const parametros = parametroId.safeParse(requisicao.params);
    const corpo = corpoSituacao.safeParse(requisicao.body);
    if (!parametros.success || !corpo.success)
      return resposta.code(400).send({ erro: 'Dados inválidos.' });
    const r = await ops.mudarSituacao(
      sessao,
      parametros.data.id,
      corpo.data.situacao,
      corpo.data.confirmar_nome,
    );
    if (r === 'nao_encontrada')
      return resposta.code(404).send({ erro: 'Instituição não encontrada.' });
    if (r === 'confirmacao')
      return resposta
        .code(409)
        .send({ erro: 'Para encerrar, escreva o nome da instituição exatamente como aparece.' });
    return resposta.code(204).send();
  });

  app.post('/operacao/instituicoes/:id/modulos', async (requisicao, resposta) => {
    const sessao = await exigir(requisicao, resposta);
    if (!sessao) return resposta;
    const parametros = parametroId.safeParse(requisicao.params);
    const corpo = corpoModulo.safeParse(requisicao.body);
    if (!parametros.success || !corpo.success)
      return resposta.code(400).send({ erro: 'Dados inválidos.' });
    const r = await ops.mudarModulo(
      sessao,
      parametros.data.id,
      corpo.data.modulo,
      corpo.data.ligado,
    );
    if (r === 'nao_encontrada')
      return resposta.code(404).send({ erro: 'Instituição não encontrada.' });
    return resposta.code(204).send();
  });

  for (const [acao, situacao] of [
    ['suspender', 'suspensa'],
    ['reativar', 'ativa'],
  ] as const) {
    app.post(`/operacao/instituicoes/:id/${acao}`, async (requisicao, resposta) => {
      const sessao = await exigir(requisicao, resposta);
      if (!sessao) return resposta;
      const parametros = parametroId.safeParse(requisicao.params);
      if (!parametros.success) return resposta.code(400).send({ erro: 'Dados inválidos.' });
      const r = await ops.mudarSituacao(sessao, parametros.data.id, situacao);
      if (r === 'nao_encontrada')
        return resposta.code(404).send({ erro: 'Instituição não encontrada.' });
      return resposta.code(204).send();
    });
  }
}
