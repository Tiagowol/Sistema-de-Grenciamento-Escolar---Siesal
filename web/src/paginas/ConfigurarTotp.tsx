import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { api, ErroApi } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Campo } from '../componentes/Campo';

// Administrador precisa do segundo fator. A chave aparece em texto para quem não lê QR code.
export function ConfigurarTotp({ aoConcluir }: { aoConcluir: () => void }) {
  const [dados, setDados] = useState<{ segredo: string; uri: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [recuperacao, setRecuperacao] = useState<string[] | null>(null);

  useEffect(() => {
    api
      .iniciarTotp()
      .then(setDados, (x) => setErro(x instanceof ErroApi ? x.message : 'Falha ao iniciar.'));
  }, []);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    try {
      const r = await api.confirmarTotp(codigo.trim());
      setRecuperacao(r.codigos_recuperacao);
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Código inválido.');
    }
  }

  if (recuperacao) {
    return (
      <section className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 className="page-title" style={{ fontSize: 24 }}>
          Guarde seus códigos de recuperação
        </h1>
        <Aviso>
          Cada código vale uma vez. Eles não serão mostrados de novo. Guarde em lugar seguro.
        </Aviso>
        <ul
          aria-label="Códigos de recuperação"
          style={{ fontFamily: 'monospace', fontSize: 18, lineHeight: 2 }}
        >
          {recuperacao.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <button type="button" className="btn btn-primary" onClick={aoConcluir}>
          Já guardei, continuar
        </button>
      </section>
    );
  }

  return (
    <form
      className="card"
      onSubmit={confirmar}
      noValidate
      style={{ maxWidth: 560, margin: '0 auto' }}
    >
      <h1 className="page-title" style={{ fontSize: 24 }}>
        Ative o segundo fator
      </h1>
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
