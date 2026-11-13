import { useEffect, useState } from 'react';
import { api, ErroApi } from '../api';
import { Aviso } from '../componentes/Aviso';

// L22a-2: link do e-mail do convite de acompanhamento (/acompanhar#LINK). Precisa de conta da pessoa (/pessoa).
// Sem sessão: pede para entrar e abrir o link de novo. Link ruim, vencido ou de outro e-mail: mesmo aviso.
export function AceitarAcompanhamento({ token }: { token: string }) {
  const [estado, setEstado] = useState<'carregando' | 'aceito' | 'entrar' | 'erro'>('carregando');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    let vivo = true;
    api
      .pessoaAceitarAcompanhamento(token)
      .then(() => vivo && setEstado('aceito'))
      .catch((x) => {
        if (!vivo) return;
        if (x instanceof ErroApi && x.status === 401) setEstado('entrar');
        else {
          setMensagem(x instanceof ErroApi ? x.message : 'Não foi possível aceitar o convite.');
          setEstado('erro');
        }
      });
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
            Convite para acompanhar um aluno
          </h1>
        </div>
        <div className="stack" aria-live="polite">
          {estado === 'carregando' ? <p className="muted">Abrindo o convite…</p> : null}
          {estado === 'entrar' ? (
            <Aviso tipo="info">
              Para aceitar, entre na sua conta e abra o link do e-mail de novo. Se ainda não tem
              conta, faça o cadastro com o mesmo e-mail que recebeu o convite.
            </Aviso>
          ) : null}
          {estado === 'erro' ? <Aviso tipo="warn">{mensagem}</Aviso> : null}
          {estado === 'aceito' ? (
            <Aviso tipo="info">
              Convite aceito. Você só vê o que o aluno liberar, e ele pode encerrar quando quiser.
              Se o aluno é menor de idade, o representante legal ainda precisa aprovar.
            </Aviso>
          ) : null}
          <a className="btn btn-primary" style={{ minHeight: 44 }} href="/pessoa">
            Ir para a entrada
          </a>
        </div>
      </div>
    </main>
  );
}
