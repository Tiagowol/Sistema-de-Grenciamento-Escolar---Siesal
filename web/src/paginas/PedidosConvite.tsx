import { useCallback, useEffect, useRef, useState } from 'react';
import { ErroApi, type PedidoConvite } from '../api';
import { Aviso } from '../componentes/Aviso';
import { diasDeEspera, quandoPediu } from './SuporteEspacos';

// L22i (item 3): fila de pedidos de convite de quem não tem código. Uma tela para o Master (console) e para o Admin indicado.
// Aprovar envia o convite por e-mail; recusar avisa sem dizer o motivo. Cartões, tempo em palavra, dia/mês e barra.
const DIAS_DA_BARRA = 14;
const mensagem = (x: unknown, padrao: string) => (x instanceof ErroApi ? x.message : padrao);

type Acao = 'aprovar' | 'recusar';
type Props = {
  nivel: 'h1' | 'h2';
  carregar: () => Promise<PedidoConvite[]>;
  decidir: (p: PedidoConvite, acao: Acao) => Promise<void>;
  aoSair?: () => void;
};

export function PedidosConvite({ nivel, carregar, decidir, aoSair }: Props) {
  const [pedidos, setPedidos] = useState<PedidoConvite[] | null>(null);
  const [confirmando, setConfirmando] = useState<{ id: string; acao: Acao } | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState('');
  const titulo = useRef<HTMLHeadingElement>(null);

  const ler = useCallback(async () => {
    try {
      setPedidos(await carregar());
    } catch (x) {
      if (x instanceof ErroApi && x.status === 401) return aoSair?.();
      setErro(mensagem(x, 'Não foi possível abrir a fila de pedidos.'));
    }
  }, [carregar, aoSair]);
  useEffect(() => {
    void ler();
  }, [ler]);

  async function enviar(p: PedidoConvite, acao: Acao) {
    setErro('');
    setFeito('');
    setTrabalhando(true);
    try {
      await decidir(p, acao);
      setFeito(
        acao === 'aprovar'
          ? `Convite enviado por e-mail para ${p.nome}. O pedido saiu da fila.`
          : `Pedido recusado. ${p.nome} foi avisado por e-mail, sem o motivo. O pedido saiu da fila.`,
      );
    } catch (x) {
      setErro(mensagem(x, 'Não foi possível concluir. Nada foi alterado.'));
    }
    setTrabalhando(false);
    setConfirmando(null);
    await ler();
    // O botão sumiu da tela: o foco vai para o título
    titulo.current?.focus();
  }

  const Cabecalho = nivel;
  return (
    <section className="card" aria-labelledby="ped-conv-titulo">
      <div className="card-head">
        <Cabecalho
          id="ped-conv-titulo"
          ref={titulo}
          tabIndex={-1}
          style={nivel === 'h1' ? { fontSize: 22 } : undefined}
        >
          Pedidos de convite
        </Cabecalho>
      </div>
      <p className="muted small">
        Pedidos de quem não tem código. Você vê o nome, o e-mail e o motivo. Aprovar cria um convite
        de 7 dias e envia o código por e-mail. Recusar avisa a pessoa por e-mail, sem dizer o
        motivo.
      </p>
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      <div role="status">{feito ? <Aviso>{feito}</Aviso> : null}</div>
      {pedidos === null ? (
        erro ? null : (
          <p role="status">Carregando…</p>
        )
      ) : pedidos.length === 0 ? (
        <p>Nenhum pedido esperando.</p>
      ) : (
        <>
          <p>
            <strong>{pedidos.length}</strong>{' '}
            {pedidos.length === 1 ? 'pedido esperando' : 'pedidos esperando'}, do mais antigo para o
            mais novo.
          </p>
          <ul className="ops-pessoas" aria-label="Pedidos esperando">
            {pedidos.map((p) => {
              const dias = diasDeEspera(p.criado_em);
              const decidindo = confirmando?.id === p.pedido_id ? confirmando.acao : null;
              return (
                <li key={p.pedido_id} className="ops-pessoa">
                  <strong>{p.nome}</strong>
                  <br />
                  <span className="small muted">{p.email}</span>
                  <blockquote>{p.motivo}</blockquote>
                  <span className="small">Pediu {quandoPediu(p.criado_em)}</span>{' '}
                  <span
                    className="suporte-barra"
                    aria-hidden="true"
                    title={`Esperando há ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
                  >
                    <span style={{ width: `${Math.min(100, (dias / DIAS_DA_BARRA) * 100)}%` }} />
                  </span>
                  <br />
                  {decidindo ? (
                    <span>
                      <span className="small">
                        {decidindo === 'aprovar'
                          ? 'Aprovar e enviar o convite por e-mail?'
                          : 'Recusar e avisar por e-mail, sem o motivo?'}
                      </span>{' '}
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ minHeight: 44 }}
                        disabled={trabalhando}
                        onClick={() => void enviar(p, decidindo)}
                      >
                        {decidindo === 'aprovar' ? 'Sim, aprovar' : 'Sim, recusar'}
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ minHeight: 44 }}
                        disabled={trabalhando}
                        onClick={() => setConfirmando(null)}
                      >
                        Não
                      </button>
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        aria-label={`Aprovar o pedido de ${p.nome}`}
                        className="btn btn-primary btn-sm"
                        style={{ minHeight: 44 }}
                        onClick={() => setConfirmando({ id: p.pedido_id, acao: 'aprovar' })}
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        aria-label={`Recusar o pedido de ${p.nome}`}
                        className="btn btn-outline btn-sm"
                        style={{ minHeight: 44 }}
                        onClick={() => setConfirmando({ id: p.pedido_id, acao: 'recusar' })}
                      >
                        Recusar
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
