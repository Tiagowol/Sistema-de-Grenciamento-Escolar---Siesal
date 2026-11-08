import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  type Autenticacao,
  criarAutenticacao,
  MENSAGEM_FALHA,
  type SessaoAtiva,
} from './auth/autenticacao.js';
import { derivarChave } from './auth/cifra.js';
import { LimitadorJanela } from './auth/limitador.js';
import { cookieDeSaida, lerCookie, serializarCookie } from './auth/sessao.js';
import type { PrismaClient } from './gerado/prisma/client.js';

export type OpcoesApp = {
  banco?: PrismaClient;
  authSecret?: string;
  agora?: () => Date;
  limiteTentativasPorMinuto?: number;
  logger?: boolean;
};

const corpoLogin = z.strictObject({
  instituicao_id: z.uuid(),
  email: z.string().min(3).max(254),
  senha: z.string().min(1).max(128),
  codigo: z.string().min(6).max(20).optional(),
});
const corpoCodigo = z.strictObject({ codigo: z.string().min(6).max(20) });

// Monta a API. Sem banco ou AUTH_SECRET, só a rota de saúde existe (deny by default).
export function criarApp(opcoes: OpcoesApp = {}) {
  const app = Fastify({ logger: opcoes.logger ?? false });
  app.get('/saude', async () => ({ status: 'ok' }));
  if (!opcoes.banco || !opcoes.authSecret) return app;

  const auth: Autenticacao = criarAutenticacao({
    banco: opcoes.banco,
    chaveTotp: derivarChave(opcoes.authSecret),
    agora: opcoes.agora,
  });
  const limitador = new LimitadorJanela(opcoes.limiteTentativasPorMinuto ?? 10, 60_000);
  const relogio = opcoes.agora ?? (() => new Date());

  // Só JSON é aceito: sem o parser de texto, formulário de outro site não chega às rotas (415)
  app.removeContentTypeParser('text/plain');

  // Respostas de autenticação nunca ficam em cache
  app.addHook('onSend', async (requisicao, resposta) => {
    if (requisicao.url.startsWith('/auth/')) resposta.header('cache-control', 'no-store');
  });

  // Limite por IP nas rotas que testam senha ou código; passou do limite = 429 e nada é processado
  const limitar = (requisicao: FastifyRequest, resposta: FastifyReply): boolean => {
    if (limitador.permitir(requisicao.ip, relogio().getTime())) return true;
    void resposta
      .code(429)
      .header('retry-after', '60')
      .send({ erro: 'Muitas tentativas. Aguarde 1 minuto.' });
    return false;
  };

  const exigirSessao = async (
    requisicao: FastifyRequest,
    resposta: FastifyReply,
  ): Promise<SessaoAtiva | null> => {
    const sessao = await auth.obterSessao(lerCookie(requisicao.headers.cookie));
    if (!sessao) void resposta.code(401).send({ erro: 'Sessão inválida ou vencida.' });
    return sessao;
  };

  app.post('/auth/login', async (requisicao, resposta) => {
    if (!limitar(requisicao, resposta)) return resposta;
    const corpo = corpoLogin.safeParse(requisicao.body);
    if (!corpo.success) return resposta.code(400).send({ erro: 'Dados inválidos.' });
    const r = await auth.login({
      instituicaoId: corpo.data.instituicao_id,
      email: corpo.data.email,
      senha: corpo.data.senha,
      codigo: corpo.data.codigo,
    });
    if (r.tipo === 'segundo_fator_necessario')
      return resposta.code(401).send({ erro: 'segundo_fator_necessario' });
    if (r.tipo === 'falha') return resposta.code(401).send({ erro: MENSAGEM_FALHA });
    return resposta
      .header('set-cookie', serializarCookie(r.token, r.duracao))
      .send({ nivel: r.nivel, usuario: r.usuario });
  });

  app.post('/auth/logout', async (requisicao, resposta) => {
    const sessao = await exigirSessao(requisicao, resposta);
    if (!sessao) return resposta;
    await auth.logout(sessao);
    return resposta.header('set-cookie', cookieDeSaida()).code(204).send();
  });

  app.get('/auth/eu', async (requisicao, resposta) => {
    const sessao = await exigirSessao(requisicao, resposta);
    if (!sessao) return resposta;
    return {
      nivel: sessao.nivel,
      usuario: { id: sessao.usuarioId, nome: sessao.nome, perfil: sessao.perfil },
    };
  });

  app.post('/auth/totp/iniciar', async (requisicao, resposta) => {
    const sessao = await exigirSessao(requisicao, resposta);
    if (!sessao) return resposta;
    const r = await auth.iniciarTotp(sessao);
    if (r.tipo === 'ja_ativo') return resposta.code(409).send({ erro: 'O TOTP já está ativo.' });
    return { segredo: r.segredo, uri: r.uri };
  });

  app.post('/auth/totp/confirmar', async (requisicao, resposta) => {
    if (!limitar(requisicao, resposta)) return resposta;
    const sessao = await exigirSessao(requisicao, resposta);
    if (!sessao) return resposta;
    const corpo = corpoCodigo.safeParse(requisicao.body);
    if (!corpo.success) return resposta.code(400).send({ erro: 'Dados inválidos.' });
    const r = await auth.confirmarTotp(sessao, corpo.data.codigo);
    if (r.tipo === 'ja_ativo') return resposta.code(409).send({ erro: 'O TOTP já está ativo.' });
    if (r.tipo === 'nao_iniciado')
      return resposta.code(409).send({ erro: 'Inicie o TOTP antes de confirmar.' });
    if (r.tipo === 'codigo_invalido') return resposta.code(401).send({ erro: 'Código inválido.' });
    return resposta
      .header('set-cookie', serializarCookie(r.token, r.duracao))
      .send({ codigos_recuperacao: r.codigosRecuperacao });
  });

  return app;
}
