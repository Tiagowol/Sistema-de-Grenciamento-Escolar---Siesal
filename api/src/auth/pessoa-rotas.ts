import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registrarAuditoria } from '../auditoria/auditoria.js';
import { withTenant } from '../banco/withTenant.js';
import type { PrismaClient } from '../gerado/prisma/client.js';
import { type Autenticacao, BLOQUEIO_MINUTOS, MAX_FALHAS, MENSAGEM_FALHA } from './autenticacao.js';
import { hashToken } from './cadastro-responsavel.js';
import { hashCodigo } from './codigos.js';
import { dataValida, idadeEm } from './cpf.js';
import type { EnviarEmail } from './email.js';
import { hashSenha, validarSenha, verificarSenha, verificarSenhaFalsa } from './senha.js';
import { type ConfigCookie, lerCookie, serializarCookie } from './sessao.js';
import { TERMO_PESSOA_VERSAO } from './termo.js';

// L22a-1b: cadastro próprio, login da pessoa e escolha de espaço (docs/PROPOSTA-L22A-1B.md).
// A pessoa tem senha e sessão acima dos espaços. Entrar num espaço abre a sessão normal daquele espaço.
const SESSAO_PESSOA_SEGUNDOS = 8 * 60 * 60;
const MENSAGEM_CADASTRO =
  'Se o e-mail puder ser usado, enviamos um link para confirmar. Abra o link para ativar o cadastro.';

export const TIPOS_PROFISSIONAIS = [
  'pedagogo',
  'psicopedagogo',
  'terapeuta_ocupacional',
  'fonoaudiologo',
  'psicologo',
  'psiquiatra',
  'outro_saude',
] as const;

const email = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .regex(/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/, 'E-mail inválido.');
const corpoCadastro = z
  .strictObject({
    nome: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .refine((t) => !/(https?:|www\.|:\/\/|@)/i.test(t), 'Não use links nem e-mail.'),
    email,
    senha: z.string().min(1).max(128),
    papel: z.enum(['professor', 'pedagogico', 'responsavel']),
    // Tipo interno do perfil Pedagógico (A-081): um só perfil para pedagogo, terapeuta ocupacional, fonoaudiólogo, etc.
    tipo_profissional: z.enum(TIPOS_PROFISSIONAIS).optional(),
    aceite: z.literal(true),
  })
  .refine((c) => (c.papel === 'pedagogico') === (c.tipo_profissional !== undefined), {
    message: 'Informe o tipo de profissional (e só para o perfil Pedagógico).',
  });
const corpoAlunoMenor = z.strictObject({
  codigo: z.string().trim().min(8).max(64),
  aluno: z.strictObject({
    nome: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .refine((t) => !/(https?:|www\.|:\/\/|@)/i.test(t), 'Não use links nem e-mail.'),
    email,
    nascimento: z.iso.date(),
    senha: z.string().min(1).max(128),
  }),
  representante_nascimento: z.iso.date(),
  // Declaração de representante legal: o sistema não consegue verificar (A-080, Q1)
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
    return s
      ? { pessoaId: s.pessoa_id, nome: s.nome, email: s.email, hash: hashToken(token) }
      : null;
  };
  const espacosDa = (pessoaId: string) =>
    dep.banco.$queryRaw<Espaco[]>`SELECT * FROM pessoa_espacos(${pessoaId}::uuid)`.then((l) =>
      l.sort((x, y) => x.instituicao_nome.localeCompare(y.instituicao_nome, 'pt-BR')),
    );

  const papelDa = (pessoaId: string) =>
    dep.banco.$queryRaw<{ p: string | null }[]>`SELECT pessoa_papel(${pessoaId}::uuid) AS p`.then(
      (l) => l[0]?.p ?? null,
    );

  // Cadastro próprio: a resposta é a mesma para e-mail novo e para e-mail que já tem conta
  app.post('/auth/pessoa/cadastro', async (req, res) => {
    if (!dep.limitar(req, res)) return res;
    const corpo = corpoCadastro.safeParse(req.body);
    if (!corpo.success)
      return res.code(400).send({ erro: 'Dados inválidos. Confira o nome, o e-mail e as caixas.' });
    const erroSenha = validarSenha(corpo.data.senha);
    if (erroSenha) return res.code(400).send({ erro: erroSenha });
    const senhaHash = await hashSenha(corpo.data.senha);
    const token = novoToken();
    const [r] = await dep.banco.$queryRaw<{ r: string }[]>`
      SELECT pessoa_cadastrar(${corpo.data.nome}, ${corpo.data.email}, ${senhaHash}, ${corpo.data.papel},
                              ${corpo.data.tipo_profissional ?? null}, ${TERMO_PESSOA_VERSAO}, ${hashToken(token)}) AS r`;
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
    if (!r?.ok)
      return res.code(400).send({ erro: 'Este link não vale mais. Faça o cadastro de novo.' });
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
      await dep.banco
        .$queryRaw`SELECT pessoa_registrar_falha(${cred.pessoa_id}::uuid, ${MAX_FALHAS}::int, ${BLOQUEIO_MINUTOS}::int)`;
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
    const [lim] = await dep.banco.$queryRaw<{ usados: number; maximo: number }[]>`
      SELECT representante_contar(${s.pessoaId}::uuid) AS usados, plataforma_limite_alunos() AS maximo`;
    // A seção "Aluno menor" é só de quem se cadastrou como representante legal (A-090)
    const ehRepresentante = (await papelDa(s.pessoaId)) === 'responsavel';
    return {
      pessoa: { nome: s.nome, email: s.email },
      ...(ehRepresentante
        ? { representante: { alunos: lim?.usados ?? 0, limite: lim?.maximo ?? 5 } }
        : {}),
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
    const r = espaco
      ? await dep.auth.entrarPorPessoa(espaco.instituicao_id, espaco.usuario_id)
      : null;
    if (!r) return res.code(403).send({ erro: 'Você não pode entrar neste espaço.' });
    return res
      .header('set-cookie', serializarCookie(r.token, r.duracao, dep.cookie))
      .send({ nivel: r.nivel, usuario: r.usuario });
  });

  // O representante legal cria o aluno menor (A-080): espaço individual, aluno, vínculo 'legal' e aceite numa transação só
  app.post('/auth/pessoa/aluno-menor', async (req, res) => {
    const s = await sessaoDaPessoa(req);
    if (!s) return res.code(401).send({ erro: 'Sessão inválida ou vencida.' });
    // Só quem se cadastrou como representante legal cria aluno menor (A-090); os demais: 403 e aviso no registro do servidor
    if ((await papelDa(s.pessoaId)) !== 'responsavel') {
      app.log.warn({ pessoa: s.pessoaId }, 'criar aluno menor negado: não é representante legal');
      return res
        .code(403)
        .send({
          erro: 'Só quem se cadastrou como representante legal pode criar a conta de aluno menor.',
        });
    }
    if (!dep.limitar(req, res)) return res;
    const corpo = corpoAlunoMenor.safeParse(req.body);
    const recusa = {
      erro: 'Não foi possível criar a conta. Confira os dados ou peça outro convite.',
    };
    if (!corpo.success) return res.code(400).send(recusa);
    const hoje = dep.agora();
    const c = corpo.data;
    if (
      !dataValida(c.aluno.nascimento, hoje) ||
      !dataValida(c.representante_nascimento, hoje) ||
      idadeEm(c.aluno.nascimento, hoje) >= 18 ||
      idadeEm(c.representante_nascimento, hoje) < 18
    )
      return res
        .code(400)
        .send({
          erro: 'Confira as datas. O aluno precisa ter menos de 18 anos e você, 18 anos ou mais.',
        });
    const erroSenha = validarSenha(c.aluno.senha);
    if (erroSenha) return res.code(400).send({ erro: erroSenha });
    const senhaHash = await hashSenha(c.aluno.senha);
    const [r] = await dep.banco.$queryRaw<{ resultado: string; instituicao_id: string | null }[]>`
      SELECT * FROM representante_criar_aluno(${s.pessoaId}::uuid, ${hashCodigo(c.codigo)}, ${c.aluno.nome},
        ${c.aluno.email}, ${senhaHash}, ${c.aluno.nascimento}::date, ${c.representante_nascimento}::date,
        ${TERMO_PESSOA_VERSAO})`;
    if (r?.resultado === 'limite')
      return res
        .code(409)
        .send({
          erro: 'Você chegou ao limite de alunos. Entre em contato com o suporte.',
          limite: true,
        });
    if (r?.resultado !== 'ok' || !r.instituicao_id) return res.code(400).send(recusa);
    await withTenant(dep.banco, { instituicaoId: r.instituicao_id }, (tx) =>
      registrarAuditoria(tx, {
        instituicaoId: r.instituicao_id as string,
        ator: `pessoa:${s.pessoaId}`,
        acao: 'representante.aluno_criado',
        alvo: `instituicao:${r.instituicao_id}`,
        depois: { termo: TERMO_PESSOA_VERSAO },
      }),
    );
    return res.code(201).send({ criado: true, instituicao_id: r.instituicao_id });
  });

  // ---------- L22a-2: a pessoa como ACOMPANHANTE. Lê por funções do banco, um aluno por vez, só o que as caixas liberam ----------
  const corpoAceitar = z.strictObject({ token: z.string().min(20).max(200) });
  const idAcompanhamento = z.strictObject({ id: z.uuid() });
  // Agenda e disciplinas seguem a caixa "Tarefas e plano" (0030)
  const itemLido = z.strictObject({
    id: z.uuid(),
    item: z.enum(['tarefas', 'agenda', 'disciplinas', 'dificuldade', 'notas', 'mensagens']),
  });

  app.post('/auth/pessoa/acompanhamento/aceitar', async (req, res) => {
    const s = await sessaoDaPessoa(req);
    if (!s) return res.code(401).send({ erro: 'Sessão inválida ou vencida.' });
    if (!dep.limitar(req, res)) return res;
    const corpo = corpoAceitar.safeParse(req.body);
    const [r] = corpo.success
      ? await dep.banco.$queryRaw<{ r: string }[]>`
          SELECT acompanhamento_aceitar(${s.pessoaId}::uuid, ${hashToken(corpo.data.token)}) AS r`
      : [{ r: 'invalido' }];
    if (r?.r === 'papel')
      return res
        .code(409)
        .send({
          erro: 'O seu cadastro é de outro tipo de profissional. Use o cadastro certo com o e-mail do convite.',
        });
    if (r?.r !== 'ok')
      return res
        .code(400)
        .send({ erro: 'Este link não vale mais, ou não é para o e-mail desta conta.' });
    return { aceito: true };
  });

  // Quem esta pessoa acompanha. Só o nome do aluno e o que foi liberado; nenhum dado do aluno.
  app.get('/auth/pessoa/acompanhando', async (req, res) => {
    const s = await sessaoDaPessoa(req);
    if (!s) return res.code(401).send({ erro: 'Sessão inválida ou vencida.' });
    const lista = await dep.banco.$queryRaw<
      Record<string, unknown>[]
    >`SELECT * FROM acompanhando_listar(${s.pessoaId}::uuid)`;
    return { alunos: lista };
  });

  app.post('/auth/pessoa/acompanhando/:id/aviso', async (req, res) => {
    const s = await sessaoDaPessoa(req);
    if (!s) return res.code(401).send({ erro: 'Sessão inválida ou vencida.' });
    const p = idAcompanhamento.safeParse(req.params);
    if (!p.success) return res.code(400).send({ erro: 'Dados inválidos.' });
    const [r] = await dep.banco.$queryRaw<{ ok: boolean }[]>`
      SELECT acompanhando_aviso_visto(${s.pessoaId}::uuid, ${p.data.id}::uuid) AS ok`;
    return r?.ok ? res.code(204).send() : res.code(404).send({ erro: 'Não encontrado.' });
  });

  // Leitura de UM item de UM aluno. Sem lista com valores de vários alunos, sem média, sem ordem, sem comparação.
  app.get('/auth/pessoa/acompanhando/:id/:item', async (req, res) => {
    const s = await sessaoDaPessoa(req);
    if (!s) return res.code(401).send({ erro: 'Sessão inválida ou vencida.' });
    const p = itemLido.safeParse(req.params);
    if (!p.success) return res.code(400).send({ erro: 'Dados inválidos.' });
    const [r] = await dep.banco.$queryRaw<{ instituicao_id: string; dados: unknown }[]>`
      SELECT * FROM acompanhando_ler(${s.pessoaId}::uuid, ${p.data.id}::uuid, ${p.data.item})`;
    if (!r) return res.code(403).send({ erro: 'Você não tem acesso a este item.' });
    // Cada leitura fica na auditoria do espaço do aluno, sem o valor lido
    await withTenant(dep.banco, { instituicaoId: r.instituicao_id }, (tx) =>
      registrarAuditoria(tx, {
        instituicaoId: r.instituicao_id,
        ator: `pessoa:${s.pessoaId}`,
        acao: 'acompanhamento.leitura',
        alvo: `acompanhamento:${p.data.id}`,
        depois: { item: p.data.item },
      }),
    );
    return { item: p.data.item, dados: r.dados };
  });

  app.post('/auth/pessoa/logout', async (req, res) => {
    const s = await sessaoDaPessoa(req);
    if (s) await dep.banco.$executeRaw`SELECT pessoa_sessao_encerrar(${s.hash})`;
    return res
      .header('set-cookie', serializarCookie('', 0, cookiePessoa))
      .code(204)
      .send();
  });
}
