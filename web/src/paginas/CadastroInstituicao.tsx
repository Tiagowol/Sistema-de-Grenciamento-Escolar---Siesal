import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, ErroApi, type Eu } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Campo } from '../componentes/Campo';
import { TERMO_INSTITUICAO_ITENS, TERMO_INSTITUICAO_VERSAO } from '../termoInstituicao';

// Link de cadastro de instituição (/cadastro/instituicao#CODIGO, 20c-3): quem recebe o convite do Master cria a
// instituição e a própria conta de Admin. Depois entra só para ativar o segundo fator (obrigatório).
export function CadastroInstituicao({
  codigoInicial,
  aoEntrar,
}: {
  codigoInicial: string;
  aoEntrar: (eu: Eu) => void;
}) {
  const [convite, setConvite] = useState(codigoInicial);
  const [instituicao, setInstituicao] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!convite.trim() || !instituicao.trim() || !nome.trim() || !email.trim() || !senha)
      return setErro('Preencha o convite, o nome da instituição, o seu nome, o e-mail e a senha.');
    if (!aceite) return setErro('Para criar a instituição, leia e aceite o termo.');
    setEnviando(true);
    try {
      const r = await api.criarInstituicao({
        codigo: convite.trim(),
        instituicao: instituicao.trim(),
        nome: nome.trim(),
        email: email.trim(),
        senha,
        aceite_termo: true,
      });
      if ('usuario' in r) aoEntrar(r);
      else window.location.assign('/');
    } catch (x) {
      setErro(
        x instanceof ErroApi ? x.message : 'Não foi possível criar a instituição. Tente de novo.',
      );
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
            Cadastrar instituição
          </h1>
        </div>
        <div className="stack">
          <p className="muted small">
            Use o convite que o Master do SIESAL deu a você. Você vira o Admin da instituição.
            Depois de criar, o sistema pede para ativar o aplicativo de autenticação (segundo
            fator).
          </p>
          {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
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
          <Campo rotulo="Nome da instituição">
            {({ id }) => (
              <input
                id={id}
                value={instituicao}
                maxLength={120}
                autoComplete="organization"
                onChange={(e) => setInstituicao(e.target.value)}
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
          <Campo rotulo="E-mail">
            {({ id }) => (
              <input
                id={id}
                type="email"
                value={email}
                autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Senha" dica="12 caracteres ou mais.">
            {({ id, descricao }) => (
              <input
                id={id}
                aria-describedby={descricao}
                type="password"
                value={senha}
                autoComplete="new-password"
                onChange={(e) => setSenha(e.target.value)}
              />
            )}
          </Campo>
          <fieldset className="termo">
            <legend>
              Termo da instituição (minuta {TERMO_INSTITUICAO_VERSAO}, sem parecer jurídico)
            </legend>
            <ol>
              {TERMO_INSTITUICAO_ITENS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
            <label className="opcao">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
              />{' '}
              Li e aceito este termo em nome da instituição.
            </label>
          </fieldset>
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {enviando ? 'Criando…' : 'Criar instituição'}
          </button>
        </div>
      </form>
    </main>
  );
}
