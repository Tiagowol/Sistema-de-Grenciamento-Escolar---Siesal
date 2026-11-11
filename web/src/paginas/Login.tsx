import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, ErroApi, type Eu } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Campo } from '../componentes/Campo';

type Props = { instituicaoPadrao: string | null; aoEntrar: (eu: Eu) => void };

export function Login({ instituicaoPadrao, aoEntrar }: Props) {
  // 20c-1: uma pergunta, duas opções. "Sem instituição" pede só e-mail e senha.
  const [modo, setModo] = useState<'instituicao' | 'individual'>('instituicao');
  const [instituicao, setInstituicao] = useState(instituicaoPadrao ?? '');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [pedirCodigo, setPedirCodigo] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Criar conta com o convite do Master (só no modo "Sem instituição")
  const [criando, setCriando] = useState(false);
  const [convite, setConvite] = useState('');
  const [nome, setNome] = useState('');

  async function criarConta(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!convite.trim() || !nome.trim() || !email.trim() || !senha)
      return setErro('Preencha o convite, o nome, o e-mail e a senha.');
    setEnviando(true);
    try {
      const r = await api.criarContaIndividual({
        codigo: convite.trim(),
        nome: nome.trim(),
        email: email.trim(),
        senha,
      });
      if ('usuario' in r) aoEntrar(r);
      else setCriando(false);
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível criar a conta. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const comuns = {
        email: email.trim(),
        senha,
        ...(codigo ? { codigo: codigo.trim() } : {}),
      };
      const eu = await api.login(
        modo === 'individual'
          ? { sem_instituicao: true, ...comuns }
          : { instituicao_id: instituicao.trim(), ...comuns },
      );
      aoEntrar(eu);
    } catch (x) {
      if (x instanceof ErroApi && x.message === 'segundo_fator_necessario') {
        setPedirCodigo(true);
        setErro('Digite o código do aplicativo de autenticação para continuar.');
      } else {
        setErro(x instanceof ErroApi ? x.message : 'Não foi possível entrar. Tente de novo.');
      }
    } finally {
      setEnviando(false);
    }
  }

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
      <form className="card" onSubmit={criando ? criarConta : enviar} noValidate>
        <div className="card-head">
          <h1 className="page-title" style={{ fontSize: 24 }}>
            {criando ? 'Criar conta' : 'Entrar'}
          </h1>
        </div>
        <div className="stack">
          {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
          <fieldset className="login-modo">
            <legend>Como você usa o SIESAL?</legend>
            <label className="opcao">
              <input
                type="radio"
                name="login-modo"
                checked={modo === 'instituicao'}
                onChange={() => {
                  setModo('instituicao');
                  setCriando(false);
                }}
              />{' '}
              Vinculado a uma instituição
            </label>
            <label className="opcao">
              <input
                type="radio"
                name="login-modo"
                checked={modo === 'individual'}
                onChange={() => setModo('individual')}
              />{' '}
              Sem instituição
            </label>
          </fieldset>
          {/* L15, item extra: o campo aparece sempre; com instituição padrão ele já vem preenchido */}
          {criando && modo === 'individual' ? (
            <>
              <p className="muted small">
                Use o convite que o Master do SIESAL deu a você. Cada convite vale para uma conta e
                por 7 dias.
              </p>
              <Campo rotulo="Código do convite" dica="Exemplo: ABCD-EFGH-JKLM-NPQR">
                {({ id, descricao }) => (
                  <input
                    id={id}
                    aria-describedby={descricao}
                    value={convite}
                    autoComplete="off"
                    onChange={(e) => setConvite(e.target.value)}
                  />
                )}
              </Campo>
              <Campo rotulo="Seu nome">
                {({ id }) => (
                  <input
                    id={id}
                    value={nome}
                    maxLength={80}
                    autoComplete="name"
                    onChange={(e) => setNome(e.target.value)}
                  />
                )}
              </Campo>
            </>
          ) : null}
          {modo === 'instituicao' ? (
            <Campo
              rotulo="Código da instituição"
              dica={
                instituicaoPadrao
                  ? 'Já preenchido com a instituição padrão. Troque se você é de outra escola.'
                  : 'Quem cadastrou você informa este código.'
              }
            >
              {({ id, descricao }) => (
                <input
                  id={id}
                  aria-describedby={descricao}
                  value={instituicao}
                  required
                  autoComplete="off"
                  onChange={(e) => setInstituicao(e.target.value)}
                />
              )}
            </Campo>
          ) : null}
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
                autoComplete={criando ? 'new-password' : 'current-password'}
                onChange={(e) => setSenha(e.target.value)}
              />
            )}
          </Campo>
          {pedirCodigo && !criando ? (
            <Campo
              rotulo="Código do aplicativo de autenticação"
              dica="6 números. Ou use um código de recuperação."
            >
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
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {criando ? (enviando ? 'Criando…' : 'Criar conta') : enviando ? 'Entrando…' : 'Entrar'}
          </button>
          {modo === 'individual' ? (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setCriando(!criando);
                setErro('');
              }}
            >
              {criando ? 'Já tenho conta' : 'Criar conta'}
            </button>
          ) : null}
        </div>
      </form>
    </main>
  );
}
