import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  apiOperacao,
  ErroApi,
  type EuOperacao,
  type EventoMaster,
  type InstituicaoLista,
  type InstituicaoPainel,
  type Modulo,
  type Perfil,
  type PessoaArvore,
  type PessoaSemVinculo,
  type Situacao,
} from '../api';
import { Aviso } from '../componentes/Aviso';
import { Campo } from '../componentes/Campo';
import { CodigoQr } from '../componentes/CodigoQr';
import { type Item, type Pagina, Shell } from '../componentes/Shell';
import { SinoPlataforma } from '../componentes/Sinos';
import { BotaoVLibras } from '../componentes/VLibras';
import { carregarInterface, type Interface, salvarInterface } from '../interface';
import { lerCodigoDoLink, linkDeCadastro } from '../linkCadastro';
import {
  aplicarPreferencias,
  carregarPreferencias,
  type Preferencias,
  salvarPreferencias,
} from '../preferencias';
import { Acessibilidade } from './Acessibilidade';
import { Ajuda } from './Ajuda';

// L18: entrada separada dos Masters (/gestao; antes /operacao). Sem menu da escola e sem nenhum dado escolar.
const mensagem = (x: unknown, padrao: string) => (x instanceof ErroApi ? x.message : padrao);
const dataCurta = (iso: string) => {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
};

function Moldura({ children }: { children: ReactNode }) {
  return (
    <main className="content ops" id="conteudo">
      <div className="brand brand-login" style={{ marginBottom: 24 }}>
        <div className="brandmark" aria-hidden="true">
          S
        </div>
        <div>
          <strong>SIESAL</strong>
          <small>Gestão da plataforma</small>
        </div>
      </div>
      {children}
    </main>
  );
}

// Entrar (usuário, senha e código) ou primeiro acesso (usuário, convite e senha nova)
function Entrada({ aoEntrar }: { aoEntrar: (eu: EuOperacao) => void }) {
  // Link de cadastro do Master: /cadastro/master#USUARIO.CODIGO (ou só #CODIGO). Depois de ler, o código sai do endereço.
  const [dosLink] = useState(() => lerCodigoDoLink('/cadastro/master'));
  const [primeiro, setPrimeiro] = useState(() => dosLink !== null);
  const [usuario, setUsuario] = useState(() =>
    dosLink?.split('.')[1] ? (dosLink.split('.')[0] ?? '') : '',
  );
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [convite, setConvite] = useState(() => dosLink?.split('.')[1] ?? dosLink ?? '');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!usuario.trim() || !senha) return setErro('Escreva o usuário e a senha.');
    if (primeiro && !convite.trim()) return setErro('Escreva o convite.');
    if (!primeiro && !/^\d{6}$/.test(codigo.trim()))
      return setErro('Escreva o código de 6 números do aplicativo de autenticação.');
    setEnviando(true);
    try {
      aoEntrar(
        primeiro
          ? await apiOperacao.primeiroAcesso({
              usuario: usuario.trim(),
              convite: convite.trim(),
              senha_nova: senha,
            })
          : await apiOperacao.login({ usuario: usuario.trim(), senha, codigo: codigo.trim() }),
      );
    } catch (x) {
      setErro(mensagem(x, 'Não foi possível entrar. Tente de novo.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="card" onSubmit={enviar} noValidate>
      <div className="card-head">
        <h1 className="page-title" style={{ fontSize: 24 }}>
          {primeiro ? 'Primeiro acesso' : 'Entrar na gestão'}
        </h1>
      </div>
      <div className="stack">
        <p className="small muted">
          Área só dos responsáveis pela plataforma. Quem é da escola entra pela{' '}
          <a href="/">página inicial</a>.
        </p>
        {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
        <Campo rotulo="Usuário">
          {({ id }) => (
            <input
              id={id}
              value={usuario}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setUsuario(e.target.value)}
            />
          )}
        </Campo>
        {primeiro ? (
          <Campo
            rotulo="Convite"
            dica="Código gerado no computador do servidor. Vale 30 minutos e uma vez."
          >
            {({ id, descricao }) => (
              <input
                id={id}
                aria-describedby={descricao}
                value={convite}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setConvite(e.target.value)}
              />
            )}
          </Campo>
        ) : null}
        <Campo
          rotulo={primeiro ? 'Senha nova' : 'Senha'}
          dica={primeiro ? 'Pelo menos 12 caracteres.' : undefined}
        >
          {({ id, descricao }) => (
            <input
              id={id}
              type="password"
              aria-describedby={descricao}
              value={senha}
              autoComplete={primeiro ? 'new-password' : 'current-password'}
              onChange={(e) => setSenha(e.target.value)}
            />
          )}
        </Campo>
        {primeiro ? null : (
          <Campo rotulo="Código do aplicativo de autenticação" dica="6 números.">
            {({ id, descricao }) => (
              <input
                id={id}
                aria-describedby={descricao}
                value={codigo}
                inputMode="numeric"
                autoComplete="one-time-code"
                onChange={(e) => setCodigo(e.target.value)}
              />
            )}
          </Campo>
        )}
        <button type="submit" className="btn btn-primary" disabled={enviando}>
          {primeiro ? 'Definir a senha' : 'Entrar'}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setErro('');
            setPrimeiro(!primeiro);
          }}
        >
          {primeiro ? 'Já tenho senha: entrar' : 'Primeiro acesso: tenho um convite'}
        </button>
      </div>
    </form>
  );
}

// Segundo fator obrigatório. A chave aparece em texto para quem não lê QR code.
function Totp({ aoConcluir }: { aoConcluir: () => void }) {
  const [dados, setDados] = useState<{ segredo: string; uri: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    apiOperacao.iniciarTotp().then(setDados, (x) => setErro(mensagem(x, 'Falha ao iniciar.')));
  }, []);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    try {
      await apiOperacao.confirmarTotp(codigo.trim());
      aoConcluir();
    } catch (x) {
      setErro(mensagem(x, 'Código inválido.'));
    }
  }

  return (
    <form className="card" onSubmit={confirmar} noValidate>
      <div className="card-head">
        <h1 className="page-title" style={{ fontSize: 24 }}>
          Ative o segundo fator
        </h1>
      </div>
      <div className="stack">
        <Aviso>
          Passo 1: abra um aplicativo de autenticação no celular (Google Authenticator, Microsoft
          Authenticator ou Authy). Passo 2: leia o QR code ou digite a chave. Passo 3: digite o
          código de 6 números que o aplicativo mostra. O código não vem por e-mail.
        </Aviso>
        {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
        {dados ? (
          <>
            <div style={{ textAlign: 'center' }}>
              <CodigoQr
                texto={dados.uri}
                rotulo="QR code para adicionar a conta ao aplicativo de autenticação"
              />
            </div>
            <p>
              Ou digite esta chave no aplicativo:{' '}
              <code style={{ fontSize: 18, wordBreak: 'break-all' }}>{dados.segredo}</code>
            </p>
            <p className="small muted">
              Endereço completo: <a href={dados.uri}>abrir no aplicativo</a>
            </p>
          </>
        ) : (
          <p role="status">Gerando chave…</p>
        )}
        <Campo rotulo="Código de 6 números">
          {({ id }) => (
            <input
              id={id}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
          )}
        </Campo>
        <button type="submit" className="btn btn-primary" disabled={!dados}>
          Ativar
        </button>
      </div>
    </form>
  );
}

// Painel do Master (L18 + L20): criar instituição, situação (4), módulos, contagens só numéricas e a trilha
// do Master. Nenhum nome de pessoa, nota ou dado de aluno.
const SITUACOES: { valor: Situacao; rotulo: string; efeito: string }[] = [
  { valor: 'em_implantacao', rotulo: 'Em implantação', efeito: 'só o Admin da escola entra' },
  { valor: 'ativa', rotulo: 'Ativa', efeito: 'todos entram' },
  { valor: 'suspensa', rotulo: 'Suspensa', efeito: 'ninguém entra; os dados ficam guardados' },
  { valor: 'encerrada', rotulo: 'Encerrada', efeito: 'ninguém entra; os dados ficam guardados' },
];
const MODULOS: { valor: Modulo; rotulo: string }[] = [
  { valor: 'mensagens', rotulo: 'Mensagens e avisos' },
  { valor: 'calendario', rotulo: 'Calendário' },
  { valor: 'apoio_aluno', rotulo: 'Apoio ao aluno' },
];
const PERFIS_CONTAGEM: { valor: Perfil; um: string; varios: string }[] = [
  { valor: 'admin', um: 'Admin', varios: 'Admin' },
  { valor: 'professor', um: 'professor', varios: 'professores' },
  { valor: 'aluno', um: 'aluno', varios: 'alunos' },
  { valor: 'pedagogico', um: 'Pedagógico', varios: 'Pedagógico' },
  { valor: 'responsavel', um: 'responsável', varios: 'responsáveis' },
];
const situacaoDe = (s: Situacao) => SITUACOES.find((x) => x.valor === s) ?? SITUACOES[1];
const contagemEmTexto = (c: InstituicaoPainel['contagem']) =>
  PERFIS_CONTAGEM.map((p) => {
    const n = c[p.valor] ?? 0;
    return `${n} ${n === 1 ? p.um : p.varios}`;
  }).join(', ');
const dataEHora = (iso: string) =>
  `${dataCurta(iso)}, ${new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

function CartaoInstituicao({
  i,
  agir,
}: {
  i: InstituicaoPainel;
  agir: (acao: () => Promise<unknown>, ok: string) => Promise<void>;
}) {
  const [nova, setNova] = useState<Situacao>(i.situacao);
  const [confirmar, setConfirmar] = useState('');
  const atual = situacaoDe(i.situacao);
  const escolhida = situacaoDe(nova);
  return (
    <li className="ops-instituicao">
      <div>
        <strong>{i.nome}</strong>
        <span className="small">
          Situação: <b>{atual?.rotulo}</b> ({atual?.efeito}). Criada em {dataCurta(i.criado_em)}.
        </span>
        <span className="small muted">Pessoas ativas: {contagemEmTexto(i.contagem)}.</span>
      </div>
      <fieldset className="ops-modulos">
        <legend>
          Módulos<span className="sr-only"> de {i.nome}</span>
        </legend>
        {MODULOS.map((m) => (
          <label key={m.valor} className="opcao-radio">
            <input
              type="checkbox"
              role="switch"
              aria-checked={i.modulos[m.valor]}
              checked={i.modulos[m.valor]}
              onChange={(e) =>
                void agir(
                  () => apiOperacao.mudarModulo(i.id, m.valor, e.target.checked),
                  `${i.nome}: ${m.rotulo} ${e.target.checked ? 'ligado' : 'desligado'}.`,
                )
              }
            />
            <span>{m.rotulo}</span>
          </label>
        ))}
      </fieldset>
      <div className="ops-situacao">
        <Campo rotulo={`Nova situação de ${i.nome}`}>
          {({ id }) => (
            <select
              id={id}
              value={nova}
              onChange={(e) => {
                setNova(e.target.value as Situacao);
                setConfirmar('');
              }}
            >
              {SITUACOES.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo}
                </option>
              ))}
            </select>
          )}
        </Campo>
        {nova === 'encerrada' && i.situacao !== 'encerrada' ? (
          <Campo
            rotulo="Para encerrar, escreva o nome da instituição"
            dica="Ninguém entra depois do encerramento. Os dados ficam guardados."
          >
            {({ id, descricao }) => (
              <input
                id={id}
                aria-describedby={descricao}
                value={confirmar}
                maxLength={120}
                onChange={(e) => setConfirmar(e.target.value)}
              />
            )}
          </Campo>
        ) : null}
        <button
          type="button"
          className="btn btn-outline"
          disabled={nova === i.situacao}
          onClick={() =>
            void agir(
              () =>
                apiOperacao.mudarSituacao(i.id, nova, nova === 'encerrada' ? confirmar : undefined),
              `${i.nome}: agora ${escolhida?.rotulo.toLowerCase()} (${escolhida?.efeito}).`,
            )
          }
        >
          Mudar a situação<span className="sr-only"> de {i.nome}</span>
        </button>
      </div>
    </li>
  );
}

function Painel({ eu, aoSair }: { eu: EuOperacao; aoSair: () => void }) {
  const [lista, setLista] = useState<InstituicaoPainel[]>([]);
  const [individuais, setIndividuais] = useState(0);
  const [convites, setConvites] = useState<{
    pendentes: number;
    usados: number;
    vencidos: number;
    instituicao?: { pendentes: number; usados: number; vencidos: number };
  }>({ pendentes: 0, usados: 0, vencidos: 0 });
  const [conviteNovo, setConviteNovo] = useState('');
  const [conviteInstituicao, setConviteInstituicao] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState('');

  const carregar = useCallback(async () => {
    try {
      const p = await apiOperacao.painel();
      setLista(p.instituicoes);
      setIndividuais(p.espacos_individuais ?? 0);
      setConvites(await apiOperacao.resumoConvites());
    } catch (x) {
      if (x instanceof ErroApi && x.status === 401) return aoSair();
      setErro(mensagem(x, 'Falha ao listar.'));
    }
  }, [aoSair]);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function agir(acao: () => Promise<unknown>, ok: string) {
    setErro('');
    setFeito('');
    try {
      await acao();
      setFeito(ok);
    } catch (x) {
      setErro(mensagem(x, 'Não foi possível concluir. Tente de novo.'));
    }
    await carregar();
  }

  async function criar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return setErro('Escreva o nome da instituição.');
    await agir(() => apiOperacao.criarInstituicao(nome.trim()), 'Instituição criada.');
    setNome('');
  }

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">Gestão da plataforma</div>
          <h1>Instituições</h1>
          <p>
            Você entrou como <b>{eu.usuario}</b>. Esta área mostra só números; nunca dados de alunos
            nem de notas.
          </p>
        </div>
      </div>
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {feito ? <Aviso>{feito}</Aviso> : null}
      <form className="card" onSubmit={criar} noValidate>
        <div className="card-head">
          <h2>Criar instituição</h2>
        </div>
        <div className="stack">
          <Campo rotulo="Nome da instituição" dica="Use somente dados fictícios.">
            {({ id, descricao }) => (
              <input
                id={id}
                aria-describedby={descricao}
                value={nome}
                maxLength={120}
                onChange={(e) => setNome(e.target.value)}
              />
            )}
          </Campo>
          <button type="submit" className="btn btn-primary">
            Criar
          </button>
        </div>
      </form>
      <section className="card mt" aria-labelledby="ops-lista-titulo">
        <div className="card-head">
          <h2 id="ops-lista-titulo">Instituições cadastradas</h2>
        </div>
        {lista.length === 0 ? <p className="muted">Nenhuma instituição cadastrada.</p> : null}
        <ul className="ops-lista">
          {lista.map((i) => (
            <CartaoInstituicao key={`${i.id}-${i.situacao}`} i={i} agir={agir} />
          ))}
        </ul>
      </section>
      <section className="card mt" aria-labelledby="ops-individuais-titulo">
        <div className="card-head">
          <h2 id="ops-individuais-titulo">Espaços individuais</h2>
        </div>
        <p>
          <strong>{individuais}</strong> {individuais === 1 ? 'espaço' : 'espaços'} de alunos sem
          instituição.
        </p>
        <p className="muted small">
          O Master vê só esta quantidade. Nome, e-mail, CPF e conteúdo de cada pessoa não aparecem
          aqui.
        </p>
        <h3 className="mt-sm">Convites</h3>
        <p className="small">
          Convites esperando uso: <strong>{convites.pendentes}</strong>. Já usados:{' '}
          <strong>{convites.usados}</strong>. Vencidos: <strong>{convites.vencidos}</strong>.
        </p>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() =>
            agir(async () => {
              const c = await apiOperacao.gerarConvite();
              setConviteNovo(c.codigo);
            }, 'Convite gerado. Copie o código agora: ele não aparece de novo.')
          }
        >
          Gerar convite
        </button>
        {conviteNovo ? (
          <div role="status" className="mt-sm">
            <p>
              Código do convite (vale 7 dias, uma conta só): <strong>{conviteNovo}</strong>
            </p>
            <p>
              Link para enviar ao aluno:{' '}
              <code style={{ wordBreak: 'break-all' }}>{linkDeCadastro('aluno', conviteNovo)}</code>
            </p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(linkDeCadastro('aluno', conviteNovo))
                  .then(() => setFeito('Link copiado.'))
                  .catch(() => setErro('Não foi possível copiar. Selecione o link e copie.'))
              }
            >
              Copiar o link
            </button>
          </div>
        ) : null}
      </section>
      <section className="card mt" aria-labelledby="ops-convite-inst-titulo">
        <div className="card-head">
          <h2 id="ops-convite-inst-titulo">Convite de instituição</h2>
        </div>
        <p className="small">
          Quem recebe o convite cria a instituição (em implantação) e a própria conta de Admin, e
          ativa o segundo fator. Depois você muda a situação para "Ativa". Esperando uso:{' '}
          <strong>{convites.instituicao?.pendentes ?? 0}</strong>. Usados:{' '}
          <strong>{convites.instituicao?.usados ?? 0}</strong>. Vencidos:{' '}
          <strong>{convites.instituicao?.vencidos ?? 0}</strong>.
        </p>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() =>
            agir(async () => {
              const c = await apiOperacao.gerarConviteInstituicao();
              setConviteInstituicao(c.codigo);
            }, 'Convite de instituição gerado. Copie agora: ele não aparece de novo.')
          }
        >
          Gerar convite de instituição
        </button>
        {conviteInstituicao ? (
          <div role="status" className="mt-sm">
            <p>
              Código (vale 7 dias, uma instituição só): <strong>{conviteInstituicao}</strong>
            </p>
            <p>
              Link para enviar:{' '}
              <code style={{ wordBreak: 'break-all' }}>
                {linkDeCadastro('instituicao', conviteInstituicao)}
              </code>
            </p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(linkDeCadastro('instituicao', conviteInstituicao))
                  .then(() => setFeito('Link copiado.'))
                  .catch(() => setErro('Não foi possível copiar. Selecione o link e copie.'))
              }
            >
              Copiar o link
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}

// L22b: menu das áreas e árvore do Master (só leitura: nome, e-mail, situação; nunca nota nem conteúdo)
type Area =
  | 'instituicoes'
  | 'administradores'
  | 'professores'
  | 'pedagogicos'
  | 'alunos'
  | 'responsaveis'
  | 'sem_vinculo';
const AREAS: { id: Exclude<Area, 'instituicoes'>; rotulo: string; perfil?: Perfil }[] = [
  { id: 'administradores', rotulo: 'Administradores', perfil: 'admin' },
  { id: 'professores', rotulo: 'Professores', perfil: 'professor' },
  { id: 'pedagogicos', rotulo: 'Pedagógicos e NAPNE', perfil: 'pedagogico' },
  { id: 'alunos', rotulo: 'Alunos', perfil: 'aluno' },
  { id: 'responsaveis', rotulo: 'Responsáveis', perfil: 'responsavel' },
  { id: 'sem_vinculo', rotulo: 'Usuários sem vínculo' },
];
const ESPACOS = 'espacos';

function LinhaPessoa({ p }: { p: PessoaArvore }) {
  return (
    <li className="ops-pessoa">
      <strong>{p.nome}</strong>
      <br />
      <span className="small">{p.email}</span>
      <br />
      <span className="small muted">
        {p.ativo ? 'Conta ativa' : 'Conta desativada'}
        {p.perfil === 'aluno' && p.menor !== null
          ? p.menor
            ? ' · Aluno menor de 18 anos'
            : ' · Aluno com 18 anos ou mais'
          : ''}
      </span>
    </li>
  );
}

function Arvore({ area }: { area: (typeof AREAS)[number] }) {
  const [escolas, setEscolas] = useState<InstituicaoLista[]>([]);
  const [onde, setOnde] = useState('');
  const [pessoas, setPessoas] = useState<PessoaArvore[] | null>(null);
  const [espacos, setEspacos] = useState<{ espaco_id: string; pessoas: PessoaArvore[] }[] | null>(
    null,
  );
  const [semVinculo, setSemVinculo] = useState<PessoaSemVinculo[] | null>(null);
  const [erro, setErro] = useState('');
  const semOnde = area.id === 'sem_vinculo';

  // Troca de área: limpa a leitura anterior (cada abertura é lida de novo e fica na trilha do Master)
  useEffect(() => {
    setOnde('');
    setPessoas(null);
    setEspacos(null);
    setSemVinculo(null);
    setErro('');
    if (area.id === 'sem_vinculo') {
      apiOperacao.arvoreSemVinculo().then(
        (r) => setSemVinculo(r.pessoas),
        (x) => setErro(mensagem(x, 'Falha ao ler.')),
      );
    } else {
      apiOperacao.instituicoes().then(
        (r) => setEscolas(r.instituicoes),
        (x) => setErro(mensagem(x, 'Falha ao listar.')),
      );
    }
  }, [area.id]);

  async function abrir(valor: string) {
    setOnde(valor);
    setPessoas(null);
    setEspacos(null);
    setErro('');
    if (!valor) return;
    try {
      if (valor === ESPACOS) setEspacos((await apiOperacao.arvoreEspacos()).espacos);
      else setPessoas((await apiOperacao.arvoreInstituicao(valor)).pessoas);
    } catch (x) {
      setErro(mensagem(x, 'Falha ao ler.'));
    }
  }

  const doPerfil = (l: PessoaArvore[]) => l.filter((p) => p.perfil === area.perfil);
  return (
    <section className="card" aria-labelledby="ops-arvore-titulo">
      <div className="card-head">
        <h1 id="ops-arvore-titulo" style={{ fontSize: 22 }}>
          {area.rotulo}
        </h1>
      </div>
      <p className="small muted">Você está só lendo. Nota, tarefa e mensagem não aparecem aqui.</p>
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {semOnde ? (
        semVinculo === null ? (
          <p role="status">Carregando…</p>
        ) : semVinculo.length === 0 ? (
          <p>Nenhuma conta sem vínculo.</p>
        ) : (
          <ul className="ops-pessoas">
            {semVinculo.map((p) => (
              <li key={p.pessoa_id} className="ops-pessoa">
                <strong>{p.nome}</strong>
                <br />
                <span className="small">{p.email}</span>
                <br />
                <span className="small muted">
                  Sem instituição ou espaço ativo
                  {p.papel_desejado ? ` · Pediu para ser ${p.papel_desejado}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <Campo rotulo="Onde olhar" dica="Escolha uma instituição ou os espaços individuais.">
            {({ id, descricao }) => (
              <select
                id={id}
                aria-describedby={descricao}
                value={onde}
                onChange={(e) => void abrir(e.target.value)}
              >
                <option value="">Escolha…</option>
                {escolas.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
                <option value={ESPACOS}>Espaços individuais</option>
              </select>
            )}
          </Campo>
          {pessoas ? (
            doPerfil(pessoas).length === 0 ? (
              <p className="mt-sm">Nenhuma pessoa nesta área.</p>
            ) : (
              <ul className="ops-pessoas mt-sm">
                {doPerfil(pessoas).map((p) => (
                  <LinhaPessoa key={p.usuario_id} p={p} />
                ))}
              </ul>
            )
          ) : null}
          {espacos ? (
            espacos.filter((e) => doPerfil(e.pessoas).length > 0).length === 0 ? (
              <p className="mt-sm">Nenhuma pessoa nesta área.</p>
            ) : (
              espacos
                .filter((e) => doPerfil(e.pessoas).length > 0)
                .map((e) => (
                  <div key={e.espaco_id} className="mt-sm">
                    <h2 style={{ fontSize: 16 }}>Espaço individual {espacos.indexOf(e) + 1}</h2>
                    <ul className="ops-pessoas">
                      {doPerfil(e.pessoas).map((p) => (
                        <LinhaPessoa key={p.usuario_id} p={p} />
                      ))}
                    </ul>
                  </div>
                ))
            )
          ) : null}
        </>
      )}
    </section>
  );
}

// Auditoria: a trilha do Master em página própria, com a conferência de integridade
function Auditoria({ aoSair }: { aoSair: () => void }) {
  const [trilha, setTrilha] = useState<{ integra: boolean; eventos: EventoMaster[] } | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    apiOperacao.trilha().then(setTrilha, (x) => {
      if (x instanceof ErroApi && x.status === 401) return aoSair();
      setErro(mensagem(x, 'Falha ao ler a trilha.'));
    });
  }, [aoSair]);
  return (
    <section className="card" aria-labelledby="ops-trilha-titulo">
      <div className="card-head">
        <h1 id="ops-trilha-titulo" style={{ fontSize: 22 }}>
          Auditoria
        </h1>
      </div>
      <p className="muted small">
        Trilha das ações do Master. Cada abertura da árvore também fica aqui.
      </p>
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {trilha ? (
        <>
          <p>
            {trilha.integra
              ? 'A trilha está íntegra: nenhum registro foi alterado.'
              : 'Atenção: a conferência achou registro alterado na trilha.'}
          </p>
          <ol className="lista-versoes">
            {trilha.eventos.map((e) => (
              <li key={e.seq}>
                {dataEHora(e.criado_em)} · {e.ator} · {e.acao}
                {e.alvo ? ` · ${e.alvo}` : ''}
              </li>
            ))}
          </ol>
        </>
      ) : erro ? null : (
        <p role="status">Carregando…</p>
      )}
    </section>
  );
}

// Suporte do Master: texto literal, sem formulário
function SuporteMaster() {
  return (
    <section className="card" aria-labelledby="ops-suporte-titulo">
      <div className="card-head">
        <h1 id="ops-suporte-titulo" style={{ fontSize: 22 }}>
          Suporte
        </h1>
      </div>
      <p>O suporte da plataforma é feito por quem cuida do SIESAL. Aqui não há formulário.</p>
      <ol>
        <li>Veja a Ajuda e a Auditoria antes de pedir ajuda.</li>
        <li>Anote o que aconteceu: a tela, o dia (dia/mês) e a instituição.</li>
        <li>Não escreva senhas, códigos de convite nem dados de alunos na mensagem.</li>
      </ol>
      <p className="muted small">
        Pedidos de suporte de alunos, professores e famílias ficam com o Admin e o Pedagógico de
        cada escola. O Master não lê esses pedidos.
      </p>
    </section>
  );
}

// Console do Master no mesmo menu e topo dos outros perfis (L22d): usa o Shell do sistema
const SECAO_ARVORE = 'Árvore (só leitura)';
const ITENS_MASTER: Item[] = [
  {
    id: 'm_instituicoes',
    rotulo: 'Instituições',
    icone: 'school',
    palavras: ['escola', 'criar', 'modulos', 'convite', 'situacao', 'espacos individuais'],
  },
  {
    id: 'm_auditoria',
    rotulo: 'Auditoria',
    icone: 'file',
    palavras: ['trilha', 'registro', 'integridade', 'acoes'],
  },
  {
    id: 'm_administradores',
    rotulo: 'Administradores',
    icone: 'lock',
    secao: SECAO_ARVORE,
    palavras: ['admin', 'arvore', 'pessoas'],
  },
  {
    id: 'm_professores',
    rotulo: 'Professores',
    icone: 'book',
    secao: SECAO_ARVORE,
    palavras: ['professor', 'arvore', 'pessoas'],
  },
  {
    id: 'm_pedagogicos',
    rotulo: 'Pedagógicos e NAPNE',
    icone: 'access',
    secao: SECAO_ARVORE,
    palavras: ['pedagogico', 'napne', 'arvore', 'pessoas'],
  },
  {
    id: 'm_alunos',
    rotulo: 'Alunos',
    icone: 'users',
    secao: SECAO_ARVORE,
    palavras: ['aluno', 'arvore', 'pessoas'],
  },
  {
    id: 'm_responsaveis',
    rotulo: 'Responsáveis',
    icone: 'home',
    secao: SECAO_ARVORE,
    palavras: ['responsavel', 'familia', 'arvore', 'pessoas'],
  },
  {
    id: 'm_sem_vinculo',
    rotulo: 'Usuários sem vínculo',
    icone: 'file',
    secao: SECAO_ARVORE,
    palavras: ['sem instituicao', 'conta solta', 'arvore'],
  },
  {
    id: 'suporte',
    rotulo: 'Suporte',
    icone: 'message',
    palavras: ['ajuda da plataforma', 'problema', 'contato'],
  },
  {
    id: 'acessibilidade',
    rotulo: 'Acessibilidade',
    icone: 'access',
    palavras: ['configuracao', 'configuracoes', 'ajustes', 'preferencias', 'opcoes'],
  },
  {
    id: 'ajuda',
    rotulo: 'Ajuda',
    icone: 'help',
    palavras: ['manual', 'como usar', 'duvida', 'tutorial', 'passo a passo'],
  },
];
const AREA_DA_PAGINA: Partial<Record<Pagina, (typeof AREAS)[number]['id']>> = {
  m_administradores: 'administradores',
  m_professores: 'professores',
  m_pedagogicos: 'pedagogicos',
  m_alunos: 'alunos',
  m_responsaveis: 'responsaveis',
  m_sem_vinculo: 'sem_vinculo',
};

function Gestao({ eu, aoSair }: { eu: EuOperacao; aoSair: () => void }) {
  const [pagina, setPagina] = useState<Pagina>('m_instituicoes');
  // Acessibilidade do Master: só neste aparelho (o Master não tem linha de preferências no banco)
  const [prefs, setPrefs] = useState<Preferencias>(() => carregarPreferencias());
  const [interfaceAtual, setInterfaceAtual] = useState<Interface>(() => carregarInterface());
  const mudarPrefs = (p: Preferencias) => {
    setPrefs(p);
    salvarPreferencias(p);
    aplicarPreferencias(p);
  };
  const mudarInterface = (i: Interface) => {
    setInterfaceAtual(i);
    salvarInterface(i);
  };
  const area = AREAS.find((a) => a.id === AREA_DA_PAGINA[pagina]);
  const euDoShell = {
    nivel: 'completo' as const,
    usuario: { id: 'master', nome: eu.usuario, perfil: 'master' },
  };
  return (
    <Shell
      eu={euDoShell}
      pagina={pagina}
      aoIr={setPagina}
      aoSair={() => void apiOperacao.logout().then(aoSair, aoSair)}
      rotulos={interfaceAtual.rotulos}
      itens={ITENS_MASTER}
      subtitulo="Gestão da plataforma"
      sinos={<SinoPlataforma aoIr={setPagina} />}
      vlibras={
        <BotaoVLibras
          ligado={interfaceAtual.vlibras}
          avisoAceito={interfaceAtual.vlibras_aviso_aceito}
          aoAceitar={() =>
            mudarInterface({ ...interfaceAtual, vlibras: true, vlibras_aviso_aceito: true })
          }
        />
      }
    >
      {area ? (
        <Arvore area={area} />
      ) : pagina === 'm_auditoria' ? (
        <Auditoria aoSair={aoSair} />
      ) : pagina === 'suporte' ? (
        <SuporteMaster />
      ) : pagina === 'ajuda' ? (
        <Ajuda perfil="master" />
      ) : pagina === 'acessibilidade' ? (
        <Acessibilidade
          valor={prefs}
          aoMudar={mudarPrefs}
          interfaceAtual={interfaceAtual}
          aoMudarInterface={mudarInterface}
        />
      ) : (
        <Painel eu={eu} aoSair={aoSair} />
      )}
    </Shell>
  );
}

export function Operacao() {
  const [pronto, setPronto] = useState(false);
  const [eu, setEu] = useState<EuOperacao | null>(null);

  const atualizar = useCallback(async () => {
    try {
      setEu(await apiOperacao.eu());
    } catch {
      setEu(null);
    }
    setPronto(true);
  }, []);
  useEffect(() => {
    document.title = 'SIESAL | Gestão da plataforma';
    void atualizar();
  }, [atualizar]);
  const sair = useCallback(() => setEu(null), []);

  if (!pronto)
    return (
      <Moldura>
        <p role="status">Carregando…</p>
      </Moldura>
    );
  if (eu?.nivel === 'completo') return <Gestao eu={eu} aoSair={sair} />;
  return (
    <Moldura>
      {!eu ? <Entrada aoEntrar={setEu} /> : <Totp aoConcluir={() => void atualizar()} />}
    </Moldura>
  );
}
