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
      <form className="card" onSubmit={enviar} noValidate>
        <div className="card-head">
          <h1 className="page-title" style={{ fontSize: 24 }}>
            Entrar
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
                onChange={() => setModo('instituicao')}
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
                autoComplete="current-password"
                onChange={(e) => setSenha(e.target.value)}
              />
            )}
          </Campo>
          {pedirCodigo ? (
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
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </form>
    </main>
  );
}
