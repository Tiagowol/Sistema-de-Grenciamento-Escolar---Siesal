import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registrarAjuda } from './ajuda/rotas.js';
import { registrarApoio } from './apoio/rotas.js';
import {
  type Autenticacao,
  criarAutenticacao,
  MENSAGEM_FALHA,
  type Nivel,
  type SessaoAtiva,
} from './auth/autenticacao.js';
import {
  confirmarPedido,
  consultarPedido,
  criarCadastroAluno,
  limparPedidosVencidos,
} from './auth/cadastro-responsavel.js';
import { derivarChave } from './auth/cifra.js';
import { criarInstituicaoPorConvite } from './auth/convite-individual.js';
import { derivarChavesCpf, mascararCpf } from './auth/cpf.js';
import type { EnviarEmail } from './auth/email.js';
import { LimitadorJanela } from './auth/limitador.js';
import { registrarRotasPessoa } from './auth/pessoa-rotas.js';
import { PERFIS_CADASTRAVEIS } from './auth/politica.js';
import { verificarSenhaFalsa } from './auth/senha.js';
import {
  COOKIE_LOCAL,
  COOKIE_PADRAO,
  cookieDeSaida,
  lerCookie,
  serializarCookie,
} from './auth/sessao.js';
import { registrarAvisos } from './avisos/rotas.js';
import { withTenant } from './banco/withTenant.js';
import { registrarConta } from './conta/rotas.js';
import { registrarEscola } from './escola/rotas.js';
import type { PrismaClient } from './gerado/prisma/client.js';
import {
  lerModulos,
  lerTipoDeEspaco,
  MODULOS_DO_ESPACO_INDIVIDUAL,
  moduloDaRota,
  rotaDoEspacoIndividual,
} from './modulos.js';
import { registrarNotas } from './notas/rotas.js';
import { registrarNucleo } from './nucleo/rotas.js';
import { registrarOperacao } from './operacao/rotas.js';
import { registrarTurmas } from './turmas/rotas.js';

export type OpcoesApp = {
  banco?: PrismaClient;
  authSecret?: string;
  agora?: () => Date;
  limiteTentativasPorMinuto?: number;
  aoRegistrarRota?: (metodo: string | string[], url: string) => void; // só testes: lista as rotas
  instituicaoPadrao?: string; // id exibido no login (demonstração com uma escola só)
  trustProxy?: boolean; // atrás do nginx do compose: usa o IP real para o limite por tentativas
  cookieLocal?: boolean; // só demonstração em http (localhost/IP); padrão: cookie seguro com __Host-
  logger?: boolean;
  chaveCpf?: string; // CPF_CHAVE: segredo próprio do CPF (20c-2). Sem ela, cadastro com CPF é recusado (503)
  enviarEmail?: EnviarEmail; // caixa de teste (Mailpit) na Parte 1; sem ela o e-mail do responsável não sai
  linkBase?: string; // endereço do site, para o link enviado ao responsável
};

// Duas entradas (20c-1): "Vinculado a uma instituição" (com o código) e "Sem instituição" (só e-mail e senha)
const camposLogin = {
  email: z.string().min(3).max(254),
  senha: z.string().min(1).max(128),
  codigo: z.string().min(6).max(20).optional(),
};
const corpoLogin = z.union([
  z.strictObject({ instituicao_id: z.uuid(), ...camposLogin }),
  z.strictObject({ sem_instituicao: z.literal(true), ...camposLogin }),
]);
// Criar a própria conta com o convite do Master (20c-1) e, no 20c-2, data de nascimento, CPF (opcional),
// matrícula e escolas (opcionais) e, para menor de 18 anos, os dados do responsável.
const nomeDePessoa = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .refine((t) => !/(https?:|www[.]|:\/\/|@)/i.test(t));
const emailValido = z
  .string()
  .trim()
  .max(254)
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
const textoCurto = (max: number) => z.string().trim().max(max).optional();
const corpoNovaConta = z.strictObject({
  codigo: z.string().min(8).max(40),
  nome: nomeDePessoa,
  email: emailValido,
  senha: z.string().min(1).max(128),
  nascimento: z.string().length(10),
  cpf: textoCurto(20),
  matricula: textoCurto(40),
  escolas: textoCurto(200),
  responsavel: z
    .strictObject({
      nome: nomeDePessoa,
      cpf: z.string().trim().max(20),
      nascimento: z.string().length(10),
      email: emailValido,
    })
    .optional(),
});
const corpoToken = z.strictObject({ token: z.string().min(20).max(100) });
const corpoConfirmar = z.strictObject({
  token: z.string().min(20).max(100),
  aceites: z.array(z.boolean()).length(3),
});
// Criar a instituição e a conta de Admin com o convite do Master (20c-3)
const corpoNovaInstituicao = z.strictObject({
  codigo: z.string().min(8).max(40),
  instituicao: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .refine((t) => !/(https?:|www[.]|:\/\/|@)/i.test(t)),
  nome: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .refine((t) => !/(https?:|www[.]|:\/\/|@)/i.test(t)),
  email: z
    .string()
    .trim()
    .max(254)
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/),
  senha: z.string().min(1).max(128),
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
  // Só para testes (L21a): lista toda rota registrada, para a varredura de injeção de SQL
  if (opcoes.aoRegistrarRota) {
    const avisar = opcoes.aoRegistrarRota;
    app.addHook('onRoute', (rota) => avisar(rota.method, rota.url));
  }
  // Saúde pública (L20: diz também se o banco responde). Só "ok" ou "fora": nenhum dado e nenhuma credencial.
  const bancoSaude = opcoes.banco;
  app.get('/saude', async () => {
    if (!bancoSaude) return { status: 'ok' };
    try {
      await bancoSaude.$queryRaw`SELECT 1`;
      return { status: 'ok', banco: 'ok' };
    } catch {
      return { status: 'ok', banco: 'fora' };
    }
  });
  if (!opcoes.banco || !opcoes.authSecret) return app;
  const banco = opcoes.banco;

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
  const chavesCpf = opcoes.chaveCpf ? derivarChavesCpf(opcoes.chaveCpf) : undefined;
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
    let instituicaoId: string;
    if ('sem_instituicao' in corpo.data) {
      // O espaço individual é achado pelo e-mail; e-mail desconhecido gasta o mesmo tempo e dá a mesma resposta
      const [achado] = await banco.$queryRaw<{ id: string | null }[]>`
        SELECT espaco_individual_achar(${corpo.data.email.trim()}) AS id`;
      if (!achado?.id) {
        await verificarSenhaFalsa(corpo.data.senha);
        return resposta.code(401).send({ erro: MENSAGEM_FALHA });
      }
      instituicaoId = achado.id;
    } else {
      instituicaoId = corpo.data.instituicao_id;
    }
    const r = await auth.login({
      instituicaoId,
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

  // L22a-1b: cadastro próprio, login da pessoa e escolha de espaço
  registrarRotasPessoa(app, {
    banco,
    auth,
    limitar,
    cookie,
    enviarEmail: opcoes.enviarEmail,
    linkBase: opcoes.linkBase,
    agora: relogio,
  });

  app.post('/auth/criar-conta-individual', async (requisicao, resposta) => {
    if (!limitar(requisicao, resposta)) return resposta;
    const corpo = corpoNovaConta.safeParse(requisicao.body);
    if (!corpo.success)
      return resposta.code(400).send({ erro: 'Confira o nome, o e-mail e o código do convite.' });
    const c = await criarCadastroAluno(banco, chavesCpf, corpo.data, relogio());
    if (c.tipo === 'senha_fraca' || c.tipo === 'dados')
      return resposta.code(400).send({ erro: c.motivo });
    if (c.tipo === 'sem_chave')
      return resposta.code(503).send({ erro: 'O cadastro com CPF não está disponível agora.' });
    if (c.tipo === 'recusada')
      return resposta.code(400).send({
        erro: 'Não foi possível criar a conta. Confira os dados ou peça outro convite.',
      });
    // Menor de 18 anos: não entra. O responsável recebe o link (caixa de teste) e confirma
    if (c.tipo === 'aguardando' && corpo.data.responsavel) {
      const link = `${(opcoes.linkBase ?? 'http://localhost:18080').replace(/\/+$/, '')}/confirmar/responsavel#${c.token}`;
      let emailEnviado = false;
      try {
        if (opcoes.enviarEmail) {
          await opcoes.enviarEmail({
            para: corpo.data.responsavel.email,
            assunto: 'SIESAL: autorização do responsável',
            texto: `Olá, ${corpo.data.responsavel.nome}.\n\n${corpo.data.nome} pediu para usar o SIESAL e precisa da sua autorização, porque tem menos de 18 anos.\n\nAbra este link, leia o termo e confirme. O link vale uma vez e por 7 dias:\n${link}\n\nSe você não conhece essa pessoa, ignore esta mensagem.\n`,
          });
          emailEnviado = true;
        }
      } catch (erro) {
        app.log.error({ err: erro }, 'e-mail do responsável não enviado');
      }
      const expira = new Date(relogio().getTime() + 7 * 86_400_000).toISOString();
      return resposta
        .code(202)
        .send({ aguardando_responsavel: true, email_enviado: emailEnviado, expira_em: expira });
    }
    // Já entra: a conta foi criada agora, com a senha que a pessoa escolheu
    if (c.tipo !== 'ok')
      return resposta.code(400).send({ erro: 'Não foi possível criar a conta.' });
    const r = await auth.login({
      instituicaoId: c.instituicaoId,
      email: corpo.data.email,
      senha: corpo.data.senha,
    });
    if (r.tipo !== 'ok') return resposta.code(201).send({ criada: true });
    return resposta
      .code(201)
      .header('set-cookie', serializarCookie(r.token, r.duracao, cookie))
      .send({ nivel: r.nivel, usuario: r.usuario });
  });

  // Autorização do responsável (20c-2): o link do e-mail abre o termo; as 3 caixas confirmam. Link inválido, vencido
  // ou já usado dá sempre a mesma resposta (404), sem dizer qual.
  app.post('/auth/responsavel/consultar', async (requisicao, resposta) => {
    if (!limitar(requisicao, resposta)) return resposta;
    const corpo = corpoToken.safeParse(requisicao.body);
    const pedido = corpo.success ? await consultarPedido(banco, corpo.data.token) : null;
    if (!pedido) return resposta.code(404).send({ erro: 'Este link não vale mais.' });
    return pedido;
  });
  app.post('/auth/responsavel/confirmar', async (requisicao, resposta) => {
    if (!limitar(requisicao, resposta)) return resposta;
    const corpo = corpoConfirmar.safeParse(requisicao.body);
    const r = corpo.success
      ? await confirmarPedido(banco, corpo.data.token, corpo.data.aceites)
      : 'recusada';
    if (r !== 'ok')
      return resposta
        .code(400)
        .send({ erro: 'Não foi possível confirmar. Marque as 3 caixas ou peça um link novo.' });
    return { confirmado: true };
  });

  // Dados do próprio cadastro, com o CPF sempre mascarado (só os 2 últimos dígitos)
  app.get('/conta/dados-cadastro', async (requisicao, resposta) => {
    const sessao = await exigirSessao(requisicao, resposta, ['completo']);
    if (!sessao) return resposta;
    return withTenant(banco, { instituicaoId: sessao.instituicaoId }, async (tx) => {
      const [d] = await tx.$queryRaw<
        {
          nascimento: Date;
          cpf_final: string | null;
          matricula: string | null;
          escolas: string | null;
        }[]
      >`SELECT nascimento, cpf_final, matricula, escolas FROM aluno_dados WHERE usuario_id = ${sessao.usuarioId}::uuid`;
      if (!d) return { cadastrado: false };
      return {
        cadastrado: true,
        nascimento: d.nascimento.toISOString().slice(0, 10),
        cpf: d.cpf_final ? mascararCpf(d.cpf_final) : null,
        matricula: d.matricula,
        escolas: d.escolas,
      };
    });
  });

  // Pedidos de responsável vencidos são apagados de hora em hora (e antes de cada uso)
  const faxina = setInterval(() => void limparPedidosVencidos(banco).catch(() => 0), 3_600_000);
  faxina.unref();
  app.addHook('onClose', async () => clearInterval(faxina));

  app.post('/auth/criar-instituicao', async (requisicao, resposta) => {
    if (!limitar(requisicao, resposta)) return resposta;
    const corpo = corpoNovaInstituicao.safeParse(requisicao.body);
    if (!corpo.success)
      return resposta.code(400).send({
        erro: 'Confira o nome da instituição, o seu nome, o e-mail e o código do convite.',
      });
    const c = await criarInstituicaoPorConvite(banco, corpo.data);
    if (c.tipo === 'senha_fraca') return resposta.code(400).send({ erro: c.motivo });
    if (c.tipo === 'recusada')
      return resposta.code(400).send({
        erro: 'Não foi possível criar a instituição. Confira os dados ou peça outro convite.',
      });
    // O Admin já entra, só para ativar o segundo fator (obrigatório)
    const r = await auth.login({
      instituicaoId: c.instituicaoId,
      email: corpo.data.email,
      senha: corpo.data.senha,
    });
    if (r.tipo !== 'ok') return resposta.code(201).send({ criada: true });
    return resposta
      .code(201)
      .header('set-cookie', serializarCookie(r.token, r.duracao, cookie))
      .send({ nivel: r.nivel, usuario: r.usuario });
  });

  app.post('/auth/logout', async (requisicao, resposta) => {
    const sessao = await exigirSessao(requisicao, resposta);
    if (!sessao) return resposta;
    await auth.logout(sessao);
    return resposta.header('set-cookie', cookieDeSaida(cookie)).code(204).send();
  });

  // L20: rota de módulo desligado pelo Master responde 403 para todos os perfis da escola.
  // 20c-1: no espaço individual só existem as rotas da lista (deny by default).
  app.addHook('preHandler', async (requisicao, resposta) => {
    const caminho = requisicao.url.split('?')[0] ?? '';
    if (caminho === '/saude' || caminho === '/config' || caminho.startsWith('/operacao')) return;
    const sessao = await auth.obterSessao(lerCookie(requisicao.headers.cookie, cookie.nome));
    if (!sessao) return; // a própria rota responde 401
    const tipo = await withTenant(banco, { instituicaoId: sessao.instituicaoId }, lerTipoDeEspaco);
    if (tipo === 'individual' && !rotaDoEspacoIndividual(caminho))
      return resposta.code(403).send({ erro: 'Este recurso não existe no espaço individual.' });
    const modulo = moduloDaRota(requisicao.url);
    if (!modulo) return;
    const ligados = await withTenant(banco, { instituicaoId: sessao.instituicaoId }, lerModulos);
    if (!ligados[modulo])
      return resposta.code(403).send({ erro: 'Este recurso está desligado nesta escola.' });
  });

  registrarNucleo(app, { banco: opcoes.banco, exigirSessao, agora: opcoes.agora });
  registrarTurmas(app, { banco: opcoes.banco, exigirSessao });
  registrarNotas(app, { banco: opcoes.banco, exigirSessao });
  registrarAvisos(app, { banco: opcoes.banco, exigirSessao });
  registrarAjuda(app, { banco: opcoes.banco, exigirSessao });
  registrarConta(app, { banco: opcoes.banco, exigirSessao, limitar });
  registrarApoio(app, { banco: opcoes.banco, exigirSessao });
  registrarEscola(app, { banco: opcoes.banco, exigirSessao });

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
      // L20: o site esconde do menu o que o Master desligou nesta escola
      ...(await withTenant(banco, { instituicaoId: sessao.instituicaoId }, async (tx) => {
        const espaco = await lerTipoDeEspaco(tx);
        return {
          espaco,
          modulos: espaco === 'individual' ? MODULOS_DO_ESPACO_INDIVIDUAL : await lerModulos(tx),
        };
      })),
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
