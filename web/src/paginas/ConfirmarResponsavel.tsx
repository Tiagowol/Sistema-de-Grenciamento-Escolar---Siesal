import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { api, ErroApi, type PedidoDoResponsavel } from '../api';
import { Aviso } from '../componentes/Aviso';
import { TempoVisual } from '../componentes/TempoVisual';
import { paraTexto } from '../datas';

// Link do responsável (/confirmar/responsavel#LINK, 20c-2): mostra o termo com 3 caixas e confirma a autorização.
// Não pede login nem mostra CPF. Link inválido, vencido ou já usado mostra sempre o mesmo aviso.
export function ConfirmarResponsavel({ token }: { token: string }) {
  const [estado, setEstado] = useState<'carregando' | 'invalido' | 'pronto' | 'confirmado'>(
    'carregando',
  );
  const [pedido, setPedido] = useState<PedidoDoResponsavel | null>(null);
  const [marcas, setMarcas] = useState([false, false, false]);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    api
      .consultarResponsavel(token)
      .then((p) => {
        if (!vivo) return;
        setPedido(p);
        setEstado('pronto');
      })
      .catch(() => vivo && setEstado('invalido'));
    return () => {
      vivo = false;
    };
  }, [token]);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!marcas.every(Boolean)) return setErro('Para confirmar, marque as 3 caixas.');
    setEnviando(true);
    try {
      await api.confirmarResponsavel(token, marcas);
      setEstado('confirmado');
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível confirmar. Tente de novo.');
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
      <div className="card">
        <div className="card-head">
          <h1 className="page-title" style={{ fontSize: 24 }}>
            Autorização do responsável
          </h1>
        </div>
        <div className="stack" aria-live="polite">
          {estado === 'carregando' ? <p className="muted">Abrindo o link…</p> : null}
          {estado === 'invalido' ? (
            <Aviso tipo="warn">
              Este link não vale mais. Ele pode ter vencido ou já ter sido usado. Peça para a pessoa
              fazer o cadastro de novo.
            </Aviso>
          ) : null}
          {estado === 'confirmado' ? (
            <Aviso tipo="info">
              Autorização confirmada. Agora a conta de {pedido?.aluno} pode entrar no SIESAL. Você
              pode fechar esta página.
            </Aviso>
          ) : null}
          {estado === 'pronto' && pedido ? (
            <form className="stack" onSubmit={confirmar} noValidate>
              <p>
                Olá, {pedido.responsavel}. <strong>{pedido.aluno}</strong> tem menos de 18 anos e
                pediu para usar o SIESAL. Leia o termo e marque as 3 caixas para autorizar.
              </p>
              <p className="muted small">
                Este link vale uma vez, até{' '}
                <TempoVisual
                  prazo={paraTexto(new Date(pedido.expiraEm))}
                  hoje={paraTexto(new Date())}
                />
                .
              </p>
              {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
              <fieldset className="login-modo">
                <legend>Termo de autorização</legend>
                {pedido.termo.caixas.map((texto, i) => (
                  <label className="opcao" key={texto}>
                    <input
                      type="checkbox"
                      checked={marcas[i] ?? false}
                      onChange={(e) =>
                        setMarcas((m) => m.map((v, j) => (j === i ? e.target.checked : v)))
                      }
                    />{' '}
                    {texto}
                  </label>
                ))}
              </fieldset>
              <button type="submit" className="btn btn-primary" disabled={enviando}>
                {enviando ? 'Confirmando…' : 'Confirmar autorização'}
              </button>
              <p className="muted small">
                Se você não quer autorizar, feche esta página. Nada é confirmado e o link vence em 7
                dias.
              </p>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  );
}
