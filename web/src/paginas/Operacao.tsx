import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  apiOperacao,
  ErroApi,
  type EuOperacao,
  type EventoMaster,
  type InstituicaoPainel,
  type Modulo,
  type Perfil,
  type Situacao,
} from '../api';
import { Aviso } from '../componentes/Aviso';
import { Campo } from '../componentes/Campo';

// L18: entrada separada dos Masters (/operacao). Sem menu da escola e sem nenhum dado escolar.
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
          <small>Operação da plataforma</small>
        </div>
      </div>
      {children}
    </main>
  );
}

// Entrar (usuário, senha e código) ou primeiro acesso (usuário, convite e senha nova)
function Entrada({ aoEntrar }: { aoEntrar: (eu: EuOperacao) => void }) {
  const [primeiro, setPrimeiro] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [convite, setConvite] = useState('');
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
          {primeiro ? 'Primeiro acesso' : 'Entrar na operação'}
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
          Passo 1: abra um aplicativo de autenticação. Passo 2: adicione uma conta com a chave
          abaixo. Passo 3: digite o código de 6 números.
        </Aviso>
        {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
        {dados ? (
          <>
            <p>
              Chave para digitar no aplicativo:{' '}
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
  const [convites, setConvites] = useState({ pendentes: 0, usados: 0, vencidos: 0 });
  const [conviteNovo, setConviteNovo] = useState('');
  const [trilha, setTrilha] = useState<{ integra: boolean; eventos: EventoMaster[] } | null>(null);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState('');

  const carregar = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([apiOperacao.painel(), apiOperacao.trilha()]);
      setLista(p.instituicoes);
      setIndividuais(p.espacos_individuais ?? 0);
      setConvites(await apiOperacao.resumoConvites());
      setTrilha(t);
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
          <div className="eyebrow">Operação da plataforma</div>
          <h1>Instituições</h1>
          <p>
            Você entrou como <b>{eu.usuario}</b>. Esta área mostra só números; nunca dados de alunos
            nem de notas.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => void apiOperacao.logout().then(aoSair, aoSair)}
        >
          Sair
        </button>
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
          <p role="status" className="mt-sm">
            Código do convite (vale 7 dias, uma conta só): <strong>{conviteNovo}</strong>
          </p>
        ) : null}
      </section>
      <section className="card mt" aria-labelledby="ops-trilha-titulo">
        <div className="card-head">
          <h2 id="ops-trilha-titulo">Trilha do Master</h2>
        </div>
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
        ) : null}
      </section>
    </>
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
    document.title = 'SIESAL | Operação da plataforma';
    void atualizar();
  }, [atualizar]);
  const sair = useCallback(() => setEu(null), []);

  if (!pronto)
    return (
      <Moldura>
        <p role="status">Carregando…</p>
      </Moldura>
    );
  return (
    <Moldura>
      {!eu ? (
        <Entrada aoEntrar={setEu} />
      ) : eu.nivel === 'configurar_totp' ? (
        <Totp aoConcluir={() => void atualizar()} />
      ) : (
        <Painel eu={eu} aoSair={sair} />
      )}
    </Moldura>
  );
}
