import { useEffect, useState } from 'react';
import { api } from '../api';
import { Aviso } from '../componentes/Aviso';

// Link do e-mail do cadastro próprio (/confirmar/email#LINK, L22a-1b). Confirma o e-mail sozinho, sem pedir login.
// Link inválido, vencido ou já usado mostra sempre o mesmo aviso.
export function ConfirmarEmail({ token }: { token: string }) {
  const [estado, setEstado] = useState<'carregando' | 'invalido' | 'confirmado'>('carregando');

  useEffect(() => {
    let vivo = true;
    api
      .pessoaConfirmarEmail(token)
      .then(() => vivo && setEstado('confirmado'))
      .catch(() => vivo && setEstado('invalido'));
    return () => {
      vivo = false;
    };
  }, [token]);

  return (
    <main
      className="content"
      style={{ maxWidth: 480, margin: '0 auto', paddingTop: 48 }}
      id="conteudo"
    >
      <div className="card">
        <div className="card-head">
          <h1 className="page-title" style={{ fontSize: 24 }}>
            Confirmação do e-mail
          </h1>
        </div>
        <div className="stack" aria-live="polite">
          {estado === 'carregando' ? <p className="muted">Abrindo o link…</p> : null}
          {estado === 'invalido' ? (
            <Aviso tipo="warn">
              Este link não vale mais. Ele pode ter vencido ou já ter sido usado. Faça o cadastro de
              novo.
            </Aviso>
          ) : null}
          {estado === 'confirmado' ? (
            <Aviso tipo="info">E-mail confirmado. Agora você já pode entrar.</Aviso>
          ) : null}
          <a className="btn btn-primary" href="/pessoa">
            Ir para a entrada
          </a>
        </div>
      </div>
    </main>
  );
}
