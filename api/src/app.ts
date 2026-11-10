import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registrarAjuda } from './ajuda/rotas.js';
import {
  type Autenticacao,
  criarAutenticacao,
  MENSAGEM_FALHA,
  type Nivel,
  type SessaoAtiva,
} from './auth/autenticacao.js';
import { derivarChave } from './auth/cifra.js';
import { LimitadorJanela } from './auth/limitador.js';
import { PERFIS_CADASTRAVEIS } from './auth/politica.js';
import {
  COOKIE_LOCAL,
  COOKIE_PADRAO,
  cookieDeSaida,
  lerCookie,
  serializarCookie,
} from './auth/sessao.js';
import { registrarAvisos } from './avisos/rotas.js';
import { registrarConta } from './conta/rotas.js';
import type { PrismaClient } from './gerado/prisma/client.js';
import { registrarNotas } from './notas/rotas.js';
import { registrarNucleo } from './nucleo/rotas.js';
import { registrarOperacao } from './operacao/rotas.js';
import { registrarTurmas } from './turmas/rotas.js';

export type OpcoesApp = {
  banco?: PrismaClient;
  authSecret?: string;
  agora?: () => Date;
  limiteTentativasPorMinuto?: number;
  instituicaoPadrao?: string; // id exibido no login (demonstração com uma escola só)
  trustProxy?: boolean; // atrás do nginx do compose: usa o IP real para o limite por tentativas
  cookieLocal?: boolean; // só demonstração em http (localhost/IP); padrão: cookie seguro com __Host-
  logger?: boolean;
};

const corpoLogin = z.strictObject({
  instituicao_id: z.uuid(),
  email: z.string().min(3).max(254),
  senha: z.string().min(1).max(128),
  codigo: z.string().min(6).max(20).optional(),
});
const corpoTrocaSenha = z.strictObject({
  senha_atual: z.string().min(1).max(128),
  senha_nova: z.string().min(1).max(200),
});
const corpoUsuario = z.strictObject({
  perfil: z.enum(PERFIS_CADASTRAVEIS),
  nome: z.string().trim().min(1).max(120),
  email: z.email().max(254),
});
const parametroUsuario = z.strictObject({ id: z.uuid() });
const corpoCodigo = z.strictObject({ codigo: z.string().min(6).max(20) });

// Monta a API. Sem banco ou AUTH_SECRET, só a rota de saúde existe (deny by default).
export function criarApp(opcoes: OpcoesApp = {}) {
  const app = Fastify({ logger: opcoes.logger ?? false, trustProxy: opcoes.trustProxy ?? false });
  app.get('/saude', async () => ({ status: 'ok' }));
  if (!opcoes.banco || !opcoes.authSecret) return app;

  // Configuração pública mínima para a tela de login (nenhum segredo)
  app.get('/config', async () => ({
    instituicao_padrao: opcoes.instituicaoPadrao ?? null,
    modo_local: Boolean(opcoes.cookieLocal),
  }));

  const auth: Autenticacao = criarAutenticacao({
    banco: opcoes.banco,
    chaveTotp: derivarChave(opcoes.authSecret),
    agora: opcoes.agora,
  });
  const limitador = new LimitadorJanela(opcoes.limiteTentativasPorMinuto ?? 10, 60_000);
  const relogio = opcoes.agora ?? (() => new Date());
  const cookie = opcoes.cookieLocal ? COOKIE_LOCAL : COOKIE_PADRAO;

  // Só JSON é aceito: sem o parser de texto, formulário de outro site não chega às rotas (415)
  app.removeContentTypeParser('text/plain');

  // Erro interno nunca mostra detalhe ao cliente (nada de SQL ou caminho); o detalhe vai só para o log
  app.setErrorHandler((erro: { statusCode?: number; message: string }, requisicao, resposta) => {
    const status = erro.statusCode && erro.statusCode >= 400 ? erro.statusCode : 500;
    if (status >= 500) {
      requisicao.log.error({ err: erro }, 'erro interno');
      return resposta.code(500).send({ erro: 'Erro interno. Tente de novo.' });
    }
    return resposta.code(status).send({ erro: erro.message });
  });

  // Nenhuma resposta da API fica em cache (dado escolar e autenticação); só a saúde fica de fora
  app.addHook('onSend', async (requisicao, resposta) => {
    if (!requisicao.url.startsWith('/saude')) resposta.header('cache-control', 'no-store');
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

  // Sessão válida e, se pedido, em um dos níveis aceitos; nível errado = 403 com a etapa pendente
  const exigirSessao = async (
    requisicao: FastifyRequest,
    resposta: FastifyReply,
    niveis?: Nivel[],
  ): Promise<SessaoAtiva | null> => {
    const sessao = await auth.obterSessao(lerCookie(requisicao.headers.cookie, cookie.nome));
    if (!sessao) {
      void resposta.code(401).send({ erro: 'Sessão inválida ou vencida.' });
      return null;
    }
    if (niveis && !niveis.includes(sessao.nivel)) {
      void resposta
        .code(403)
        .send({ erro: 'Conclua a etapa pendente antes de continuar.', nivel: sessao.nivel });
      return null;
    }
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
      .header('set-cookie', serializarCookie(r.token, r.duracao, cookie))
      .send({ nivel: r.nivel, usuario: r.usuario });
  });

  app.post('/auth/logout', async (requisicao, resposta) => {
    const sessao = await exigirSessao(requisicao, resposta);
    if (!sessao) return resposta;
    await auth.logout(sessao);
    return resposta.header('set-cookie', cookieDeSaida(cookie)).code(204).send();
  });

  registrarNucleo(app, { banco: opcoes.banco, exigirSessao, agora: opcoes.agora });
  registrarTurmas(app, { banco: opcoes.banco, exigirSessao });
  registrarNotas(app, { banco: opcoes.banco, exigirSessao });
  registrarAvisos(app, { banco: opcoes.banco, exigirSessao });
  registrarAjuda(app, { banco: opcoes.banco, exigirSessao });
  registrarConta(app, { banco: opcoes.banco, exigirSessao, limitar });

  // L18: Masters em /operacao, com cookie, limite por IP e papel de banco próprios (nada de dado escolar)
  const limitadorOperacao = new LimitadorJanela(opcoes.limiteTentativasPorMinuto ?? 10, 60_000);
  registrarOperacao(app, {
    banco: opcoes.banco,
    chaveTotp: derivarChave(opcoes.authSecret),
    agora: opcoes.agora,
    cookieLocal: Boolean(opcoes.cookieLocal),
    limitar: (requisicao, resposta) => {
      if (limitadorOperacao.permitir(requisicao.ip, relogio().getTime())) return true;
      void resposta
        .code(429)
        .header('retry-after', '60')
        .send({ erro: 'Muitas tentativas. Aguarde 1 minuto.' });
      return false;
    },
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
    const sessao = await exigirSessao(requisicao, resposta, ['completo', 'configurar_totp']);
    if (!sessao) return resposta;
    const r = await auth.iniciarTotp(sessao);
    if (r.tipo === 'ja_ativo') return resposta.code(409).send({ erro: 'O TOTP já está ativo.' });
    return { segredo: r.segredo, uri: r.uri };
  });

  app.post('/auth/totp/confirmar', async (requisicao, resposta) => {
    if (!limitar(requisicao, resposta)) return resposta;
    const sessao = await exigirSessao(requisicao, resposta, ['completo', 'configurar_totp']);
    if (!sessao) return resposta;
    const corpo = corpoCodigo.safeParse(requisicao.body);
    if (!corpo.success) return resposta.code(400).send({ erro: 'Dados inválidos.' });
    const r = await auth.confirmarTotp(sessao, corpo.data.codigo);
    if (r.tipo === 'ja_ativo') return resposta.code(409).send({ erro: 'O TOTP já está ativo.' });
    if (r.tipo === 'nao_iniciado')
      return resposta.code(409).send({ erro: 'Inicie o TOTP antes de confirmar.' });
    if (r.tipo === 'codigo_invalido') return resposta.code(401).send({ erro: 'Código inválido.' });
    return resposta
      .header('set-cookie', serializarCookie(r.token, r.duracao, cookie))
      .send({ codigos_recuperacao: r.codigosRecuperacao });
  });

  app.post('/auth/senha/trocar', async (requisicao, resposta) => {
    if (!limitar(requisicao, resposta)) return resposta;
    const sessao = await exigirSessao(requisicao, resposta);
    if (!sessao) return resposta;
    const corpo = corpoTrocaSenha.safeParse(requisicao.body);
    if (!corpo.success) return resposta.code(400).send({ erro: 'Dados inválidos.' });
    const r = await auth.trocarSenha(sessao, corpo.data.senha_atual, corpo.data.senha_nova);
    if (r.tipo === 'senha_fraca') return resposta.code(400).send({ erro: r.mensagem });
    if (r.tipo === 'senha_igual') {
      return resposta.code(400).send({ erro: 'A senha nova precisa ser diferente da atual.' });
    }
    if (r.tipo === 'senha_atual_invalida') {
      return resposta.code(401).send({ erro: 'Senha atual incorreta.' });
    }
    return resposta
      .header('set-cookie', serializarCookie(r.token, r.duracao, cookie))
      .send({ nivel: r.nivel });
  });

  app.get('/usuarios', async (requisicao, resposta) => {
    const sessao = await exigirSessao(requisicao, resposta, ['completo']);
    if (!sessao) return resposta;
    const r = await auth.listarUsuarios(sessao);
    if (r.tipo === 'proibido') return resposta.code(403).send({ erro: 'Sem permissão.' });
    return { usuarios: r.usuarios };
  });

  app.post('/usuarios', async (requisicao, resposta) => {
    const sessao = await exigirSessao(requisicao, resposta, ['completo']);
    if (!sessao) return resposta;
    const corpo = corpoUsuario.safeParse(requisicao.body);
    if (!corpo.success) return resposta.code(400).send({ erro: 'Dados inválidos.' });
    const r = await auth.criarUsuario(sessao, corpo.data);
    if (r.tipo === 'proibido') return resposta.code(403).send({ erro: 'Sem permissão.' });
    if (r.tipo === 'email_em_uso') {
      return resposta.code(409).send({ erro: 'Já existe usuário com este e-mail.' });
    }
    return resposta.code(201).send({ usuario: r.usuario, senha_provisoria: r.senhaProvisoria });
  });

  app.post('/usuarios/:id/senha-provisoria', async (requisicao, resposta) => {
    const sessao = await exigirSessao(requisicao, resposta, ['completo']);
    if (!sessao) return resposta;
    const parametros = parametroUsuario.safeParse(requisicao.params);
    if (!parametros.success) return resposta.code(400).send({ erro: 'Dados inválidos.' });
    const r = await auth.redefinirSenha(sessao, parametros.data.id);
    if (r.tipo === 'proibido') return resposta.code(403).send({ erro: 'Sem permissão.' });
    if (r.tipo === 'nao_encontrado')
      return resposta.code(404).send({ erro: 'Usuário não encontrado.' });
    return { senha_provisoria: r.senhaProvisoria };
  });

  return app;
}
