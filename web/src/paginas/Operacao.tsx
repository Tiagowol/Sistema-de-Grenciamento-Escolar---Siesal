import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { apiOperacao, ErroApi, type EuOperacao, type InstituicaoLista } from '../api';
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

// Painel mínimo: ver, criar, suspender e reativar instituições. Só nome, situação e data.
function Painel({ eu, aoSair }: { eu: EuOperacao; aoSair: () => void }) {
  const [lista, setLista] = useState<InstituicaoLista[]>([]);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState('');

  const carregar = useCallback(async () => {
    try {
      setLista((await apiOperacao.instituicoes()).instituicoes);
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
      await carregar();
    } catch (x) {
      setErro(mensagem(x, 'Não foi possível concluir. Tente de novo.'));
    }
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
            Você entrou como <b>{eu.usuario}</b>. Esta área não mostra dados de alunos nem de notas.
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
            <li key={i.id}>
              <div>
                <strong>{i.nome}</strong>
                <span className="small muted">
                  Situação: {i.situacao === 'ativa' ? 'ativa' : 'suspensa'}. Criada em{' '}
                  {dataCurta(i.criado_em)}.
                </span>
              </div>
              {i.situacao === 'ativa' ? (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() =>
                    void agir(
                      () => apiOperacao.suspender(i.id),
                      `${i.nome}: suspensa. As pessoas dessa instituição não entram até a reativação.`,
                    )
                  }
                >
                  Suspender<span className="sr-only"> {i.nome}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() =>
                    void agir(() => apiOperacao.reativar(i.id), `${i.nome}: reativada.`)
                  }
                >
                  Reativar<span className="sr-only"> {i.nome}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
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
