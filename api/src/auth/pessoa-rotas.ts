import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '../gerado/prisma/client.js';
import { type Autenticacao, BLOQUEIO_MINUTOS, MAX_FALHAS, MENSAGEM_FALHA } from './autenticacao.js';
import { hashToken } from './cadastro-responsavel.js';
import type { EnviarEmail } from './email.js';
import { hashSenha, validarSenha, verificarSenha, verificarSenhaFalsa } from './senha.js';
import { type ConfigCookie, lerCookie, serializarCookie } from './sessao.js';
import { TERMO_PESSOA_VERSAO } from './termo.js';

// L22a-1b: cadastro próprio, login da pessoa e escolha de espaço (docs/PROPOSTA-L22A-1B.md).
// A pessoa tem senha e sessão acima dos espaços. Entrar num espaço abre a sessão normal daquele espaço.
const SESSAO_PESSOA_SEGUNDOS = 8 * 60 * 60;
const MENSAGEM_CADASTRO =
  'Se o e-mail puder ser usado, enviamos um link para confirmar. Abra o link para ativar o cadastro.';

const email = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .regex(/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/, 'E-mail inválido.');
const corpoCadastro = z.strictObject({
  nome: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .refine((t) => !/(https?:|www\.|:\/\/|@)/i.test(t), 'Não use links nem e-mail.'),
  email,
  senha: z.string().min(1).max(128),
  papel: z.enum(['professor', 'pedagogico']),
  aceite: z.literal(true),
});
const corpoLoginPessoa = z.strictObject({ email, senha: z.string().min(1).max(128) });
const corpoToken = z.strictObject({ token: z.string().min(20).max(200) });
const corpoEntrar = z.strictObject({ instituicao_id: z.uuid() });

type Dependencias = {
  banco: PrismaClient;
  auth: Autenticacao;
  limitar: (req: FastifyRequest, res: FastifyReply) => boolean;
  cookie: ConfigCookie; // cookie da sessão de espaço
  enviarEmail?: EnviarEmail;
  linkBase?: string;
  agora: () => Date;
};

type Espaco = {
  instituicao_id: string;
  instituicao_nome: string;
  tipo: string;
  perfil: string;
  usuario_id: string;
};

export function registrarRotasPessoa(app: FastifyInstance, dep: Dependencias): void {
  // Cookie próprio da pessoa, separado do cookie de espaço
  const cookiePessoa: ConfigCookie = {
    nome: dep.cookie.seguro ? '__Host-siesal_pessoa' : 'siesal_pessoa',
    seguro: dep.cookie.seguro,
  };
  const novoToken = () => randomBytes(32).toString('base64url');

  const sessaoDaPessoa = async (req: FastifyRequest) => {
    const token = lerCookie(req.headers.cookie, cookiePessoa.nome);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const [s] = await dep.banco.$queryRaw<{ pessoa_id: string; nome: string; email: string }[]>`
      SELECT pessoa_id, nome, email FROM pessoa_sessao_obter(${hashToken(token)})`;
    return s ? { pessoaId: s.pessoa_id, nome: s.nome, email: s.email, hash: hashToken(token) } : null;
  };
  const espacosDa = (pessoaId: string) =>
    dep.banco
      .$queryRaw<Espaco[]>`SELECT * FROM pessoa_espacos(${pessoaId}::uuid)`
      .then((l) => l.sort((x, y) => x.instituicao_nome.localeCompare(y.instituicao_nome, 'pt-BR')));

  // Cadastro próprio: a resposta é a mesma para e-mail novo e para e-mail que já tem conta
  app.post('/auth/pessoa/cadastro', async (req, res) => {
    if (!dep.limitar(req, res)) return res;
    const corpo = corpoCadastro.safeParse(req.body);
    if (!corpo.success) return res.code(400).send({ erro: 'Dados inválidos. Confira o nome, o e-mail e as caixas.' });
    const erroSenha = validarSenha(corpo.data.senha);
    if (erroSenha) return res.code(400).send({ erro: erroSenha });
    const senhaHash = await hashSenha(corpo.data.senha);
    const token = novoToken();
    const [r] = await dep.banco.$queryRaw<{ r: string }[]>`
      SELECT pessoa_cadastrar(${corpo.data.nome}, ${corpo.data.email}, ${senhaHash}, ${corpo.data.papel},
                              ${TERMO_PESSOA_VERSAO}, ${hashToken(token)}) AS r`;
    if (r?.r === 'ok' && dep.enviarEmail) {
      const link = `${(dep.linkBase ?? 'http://localhost:18080').replace(/\/+$/, '')}/confirmar/email#${token}`;
      try {
        await dep.enviarEmail({
          para: corpo.data.email,
          assunto: 'SIESAL: confirme o seu e-mail',
          texto: `Olá, ${corpo.data.nome}.\n\nAbra este link para confirmar o seu e-mail e ativar o cadastro. O link vale uma vez e por 24 horas:\n${link}\n\nSe você não pediu este cadastro, ignore esta mensagem.\n`,
        });
      } catch (erro) {
        app.log.error({ err: erro }, 'e-mail de confirmação não enviado');
      }
    }
    return res.code(202).send({ mensagem: MENSAGEM_CADASTRO });
  });

  app.post('/auth/pessoa/confirmar-email', async (req, res) => {
    if (!dep.limitar(req, res)) return res;
    const corpo = corpoToken.safeParse(req.body);
    const [r] = corpo.success
      ? await dep.banco.$queryRaw<{ ok: boolean }[]>`
          SELECT pessoa_confirmar_email(${hashToken(corpo.data.token)}) AS ok`
      : [{ ok: false }];
    if (!r?.ok) return res.code(400).send({ erro: 'Este link não vale mais. Faça o cadastro de novo.' });
    return { confirmado: true };
  });

  app.post('/auth/pessoa/login', async (req, res) => {
    if (!dep.limitar(req, res)) return res;
    const corpo = corpoLoginPessoa.safeParse(req.body);
    if (!corpo.success) return res.code(400).send({ erro: 'Dados inválidos.' });
    const [cred] = await dep.banco.$queryRaw<
      { pessoa_id: string; nome: string; senha_hash: string; bloqueado_ate: Date | null }[]
    >`SELECT * FROM pessoa_credencial(${corpo.data.email})`;
    // Sem conta ou bloqueada: gasta o mesmo tempo de uma conferência real e dá a mesma resposta
    if (!cred || (cred.bloqueado_ate && cred.bloqueado_ate > dep.agora())) {
      await verificarSenhaFalsa(corpo.data.senha);
      return res.code(401).send({ erro: MENSAGEM_FALHA });
    }
    if (!(await verificarSenha(corpo.data.senha, cred.senha_hash))) {
      await dep.banco.$queryRaw`SELECT pessoa_registrar_falha(${cred.pessoa_id}::uuid, ${MAX_FALHAS}::int, ${BLOQUEIO_MINUTOS}::int)`;
      return res.code(401).send({ erro: MENSAGEM_FALHA });
    }
    const token = novoToken();
    await dep.banco
      .$executeRaw`SELECT pessoa_sessao_abrir(${cred.pessoa_id}::uuid, ${hashToken(token)}, ${SESSAO_PESSOA_SEGUNDOS}::int)`;
    return res
      .header('set-cookie', serializarCookie(token, SESSAO_PESSOA_SEGUNDOS, cookiePessoa))
      .send({ pessoa: { nome: cred.nome } });
  });

  // Quem sou eu e onde posso entrar. Lista vazia = ainda não participa de nenhum espaço.
  app.get('/auth/pessoa/eu', async (req, res) => {
    const s = await sessaoDaPessoa(req);
    if (!s) return res.code(401).send({ erro: 'Sessão inválida ou vencida.' });
    const espacos = await espacosDa(s.pessoaId);
    return {
      pessoa: { nome: s.nome, email: s.email },
      espacos: espacos.map((e) => ({
        instituicao_id: e.instituicao_id,
        nome: e.instituicao_nome,
        tipo: e.tipo,
        perfil: e.perfil,
      })),
    };
  });

  // Entra num espaço onde a pessoa participa: abre a sessão normal daquele espaço, sem pedir a senha de novo
  app.post('/auth/pessoa/entrar', async (req, res) => {
    const s = await sessaoDaPessoa(req);
    if (!s) return res.code(401).send({ erro: 'Sessão inválida ou vencida.' });
    const corpo = corpoEntrar.safeParse(req.body);
    if (!corpo.success) return res.code(400).send({ erro: 'Dados inválidos.' });
    const espaco = (await espacosDa(s.pessoaId)).find(
      (e) => e.instituicao_id === corpo.data.instituicao_id,
    );
    const r = espaco ? await dep.auth.entrarPorPessoa(espaco.instituicao_id, espaco.usuario_id) : null;
    if (!r) return res.code(403).send({ erro: 'Você não pode entrar neste espaço.' });
    return res
      .header('set-cookie', serializarCookie(r.token, r.duracao, dep.cookie))
      .send({ nivel: r.nivel, usuario: r.usuario });
  });

  app.post('/auth/pessoa/logout', async (req, res) => {
    const s = await sessaoDaPessoa(req);
    if (s) await dep.banco.$executeRaw`SELECT pessoa_sessao_encerrar(${s.hash})`;
    return res.header('set-cookie', serializarCookie('', 0, cookiePessoa)).code(204).send();
  });
}
