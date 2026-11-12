import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { api, ErroApi, type Eu, type PessoaEu } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Campo } from '../componentes/Campo';

// L22a-1b: acesso de professor e pedagogo SEM instituição (/pessoa). Três etapas: cadastro, entrada e escolha de espaço.
// Texto literal, sem pressão. Quem ainda não tem espaço vê uma explicação e nada escolar.
type Etapa = 'entrar' | 'cadastro' | 'cadastrado' | 'espacos';
const PAPEL: Record<string, string> = { professor: 'Professor', pedagogico: 'Pedagógico' };
const TIPO: Record<string, string> = { escola: 'Instituição', individual: 'Aluno isolado' };

function Moldura({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main
      className="content"
      style={{ maxWidth: 480, margin: '0 auto', paddingTop: 48 }}
      id="conteudo"
    >
      <div className="brand brand-login" style={{ marginBottom: 24 }}>
        <div className="brandmark" aria-hidden="true">
          S
        </div>
        <div>
          <strong>SIESAL</strong>
          <small>Educação e inclusão</small>
        </div>
      </div>
      <div className="card">
        <div className="card-head">
          <h1 className="page-title" style={{ fontSize: 24 }}>
            {titulo}
          </h1>
        </div>
        {children}
      </div>
    </main>
  );
}

export function AcessoPessoa({ aoEntrar }: { aoEntrar: (eu: Eu) => void }) {
  const [etapa, setEtapa] = useState<Etapa>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState<'professor' | 'pedagogico'>('professor');
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [eu, setEu] = useState<PessoaEu | null>(null);

  // Se a pessoa já entrou antes (cookie), mostra direto a escolha de espaço
  useEffect(() => {
    let vivo = true;
    api
      .pessoaEu()
      .then((r) => {
        if (!vivo) return;
        setEu(r);
        setEtapa('espacos');
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  async function cadastrar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!aceite) return setErro('Para se cadastrar, marque a caixa do termo.');
    setEnviando(true);
    try {
      await api.pessoaCadastro({ nome, email, senha, papel, aceite: true });
      setEtapa('cadastrado');
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível cadastrar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await api.pessoaLogin({ email, senha });
      setEu(await api.pessoaEu());
      setSenha('');
      setEtapa('espacos');
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível entrar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  async function irParaEspaco(instituicaoId: string) {
    setErro('');
    setEnviando(true);
    try {
      await api.pessoaEntrar(instituicaoId);
      aoEntrar(await api.eu());
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível entrar neste espaço.');
    } finally {
      setEnviando(false);
    }
  }

  async function sair() {
    await api.pessoaLogout().catch(() => undefined);
    setEu(null);
    setEtapa('entrar');
  }

  if (etapa === 'cadastrado')
    return (
      <Moldura titulo="Confira o seu e-mail">
        <div className="stack" aria-live="polite">
          <Aviso tipo="info">
            Se o e-mail puder ser usado, enviamos um link para confirmar. Abra o link para ativar o
            cadastro. O link vale uma vez e por 24 horas.
          </Aviso>
          <a className="btn btn-outline" href="/pessoa">
            Voltar para a entrada
          </a>
        </div>
      </Moldura>
    );

  if (etapa === 'espacos' && eu)
    return (
      <Moldura titulo="Escolha o espaço">
        <div className="stack" aria-live="polite">
          <p>Olá, {eu.pessoa.nome}.</p>
          {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
          {eu.espacos.length === 0 ? (
            <Aviso tipo="info">
              Você ainda não participa de nenhum espaço. Quando um aluno ou uma instituição convidar
              você e o convite for aceito, o espaço aparece aqui. Até lá, você não vê nenhum dado de
              aluno.
            </Aviso>
          ) : (
            <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
              {eu.espacos.map((e) => (
                <li key={e.instituicao_id}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: '100%', minHeight: 44 }}
                    disabled={enviando}
                    onClick={() => void irParaEspaco(e.instituicao_id)}
                  >
                    {e.nome} — {PAPEL[e.perfil] ?? e.perfil} ({TIPO[e.tipo] ?? e.tipo})
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn btn-outline" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </Moldura>
    );

  if (etapa === 'cadastro')
    return (
      <Moldura titulo="Cadastro de professor e pedagogo">
        <form className="stack" onSubmit={cadastrar} noValidate>
          <p className="muted small">
            Para quem ainda não está em uma instituição. O cadastro não dá acesso a nenhum aluno. O
            acesso vem depois, quando um aluno (ou a instituição) convidar você e o convite for
            aceito.
          </p>
          {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
          <Campo rotulo="Seu nome">
            {({ id }) => (
              <input
                id={id}
                value={nome}
                required
                autoComplete="name"
                onChange={(e) => setNome(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="E-mail" dica="Enviamos um link para confirmar este e-mail.">
            {({ id, descricao }) => (
              <input
                id={id}
                aria-describedby={descricao}
                type="email"
                value={email}
                required
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Senha" dica="Pelo menos 12 caracteres.">
            {({ id, descricao }) => (
              <input
                id={id}
                aria-describedby={descricao}
                type="password"
                value={senha}
                required
                autoComplete="new-password"
                onChange={(e) => setSenha(e.target.value)}
              />
            )}
          </Campo>
          <fieldset className="login-modo">
            <legend>Como você atua</legend>
            {(['professor', 'pedagogico'] as const).map((p) => (
              <label key={p} className="check">
                <input
                  type="radio"
                  name="papel-pessoa"
                  checked={papel === p}
                  onChange={() => setPapel(p)}
                />{' '}
                {p === 'professor' ? 'Professor' : 'Pedagógico ou NAPNE'}
              </label>
            ))}
          </fieldset>
          <label className="check">
            <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />{' '}
            Declaro que os dados que informei são verdadeiros e são de minha responsabilidade, e
            que li o termo de uso.
          </label>
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {enviando ? 'Cadastrando…' : 'Cadastrar'}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setErro('');
              setEtapa('entrar');
            }}
          >
            Já tenho cadastro
          </button>
        </form>
      </Moldura>
    );

  return (
    <Moldura titulo="Entrar como professor ou pedagogo">
      <form className="stack" onSubmit={entrar} noValidate>
        <p className="muted small">
          Para quem tem cadastro próprio, sem instituição. Quem já tem conta em uma instituição
          entra pela tela principal.
        </p>
        {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
        <Campo rotulo="E-mail">
          {({ id }) => (
            <input
              id={id}
              type="email"
              value={email}
              required
              autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Senha">
          {({ id }) => (
            <input
              id={id}
              type="password"
              value={senha}
              required
              autoComplete="current-password"
              onChange={(e) => setSenha(e.target.value)}
            />
          )}
        </Campo>
        <button type="submit" className="btn btn-primary" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setErro('');
            setEtapa('cadastro');
          }}
        >
          Criar cadastro
        </button>
        <a href="/">Voltar para a tela principal</a>
      </form>
    </Moldura>
  );
}
