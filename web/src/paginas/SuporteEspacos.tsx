import { useCallback, useEffect, useRef, useState } from 'react';
import { apiOperacao, type CandidatoAtendente, ErroApi, type PedidoSuporteEspaco } from '../api';
import { Aviso } from '../componentes/Aviso';

// L22f: suporte dos espaços individuais (aluno sem escola e o representante com o aluno menor).
// Uma tela só para o Master (console) e para o Admin indicado (menu da escola). Cartões, nunca tabela larga.
// Tempo concreto: palavra ("hoje", "ontem", "há 3 dias"), dia/mês e uma barra que enche com a espera.
// Texto literal, sem pressão. Só se lê e se marca "atendido": a resposta é por e-mail, fora do sistema.
const ASSUNTO: Record<string, string> = {
  acesso: 'Não consigo entrar',
  nao_consigo_usar: 'Não consigo usar uma tela',
  duvida_nota: 'Dúvida sobre uma nota',
  erro_na_tela: 'Apareceu um erro',
  outro: 'Outro assunto',
};
const DIAS_DA_BARRA = 14;
const doisDigitos = (n: number) => String(n).padStart(2, '0');
const diaLocal = (d: Date) =>
  `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
const MS_DIA = 86_400_000;

export function diasDeEspera(iso: string, agora: Date = new Date()): number {
  const a = new Date(`${diaLocal(agora)}T00:00:00`).getTime();
  const b = new Date(`${diaLocal(new Date(iso))}T00:00:00`).getTime();
  return Math.max(0, Math.round((a - b) / MS_DIA));
}

// Exemplo: "hoje, 14/11", "ontem, 13/11" ou "há 3 dias, 11/11"
export function quandoPediu(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  const n = diasDeEspera(iso, agora);
  const palavra = n === 0 ? 'hoje' : n === 1 ? 'ontem' : `há ${n} dias`;
  return `${palavra}, ${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}`;
}

const mensagem = (x: unknown, padrao: string) => (x instanceof ErroApi ? x.message : padrao);

type Props = {
  nivel: 'h1' | 'h2';
  carregar: () => Promise<PedidoSuporteEspaco[]>;
  atender: (p: PedidoSuporteEspaco) => Promise<void>;
  aoSair?: () => void;
};

export function SuporteEspacos({ nivel, carregar, atender, aoSair }: Props) {
  const [pedidos, setPedidos] = useState<PedidoSuporteEspaco[] | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState('');
  const titulo = useRef<HTMLHeadingElement>(null);

  const ler = useCallback(async () => {
    try {
      setPedidos(await carregar());
      setErro('');
    } catch (x) {
      if (x instanceof ErroApi && x.status === 401) return aoSair?.();
      setErro(mensagem(x, 'Não foi possível abrir a fila de pedidos.'));
    }
  }, [carregar, aoSair]);
  useEffect(() => {
    void ler();
  }, [ler]);

  async function marcar(p: PedidoSuporteEspaco) {
    setErro('');
    setFeito('');
    try {
      await atender(p);
      setFeito('Pedido marcado como atendido. Ele saiu da fila.');
    } catch (x) {
      setErro(mensagem(x, 'Não foi possível marcar como atendido.'));
    }
    setConfirmando(null);
    await ler();
    // O botão sumiu da tela: o foco vai para o título, para o teclado não voltar ao início da página
    titulo.current?.focus();
  }

  const Cabecalho = nivel;
  return (
    <section className="card" aria-labelledby="sup-esp-titulo">
      <div className="card-head">
        <Cabecalho
          id="sup-esp-titulo"
          ref={titulo}
          tabIndex={-1}
          style={nivel === 'h1' ? { fontSize: 22 } : undefined}
        >
          Suporte dos espaços individuais
        </Cabecalho>
      </div>
      <p className="muted small">
        Pedidos de alunos sem escola e de representantes legais. Você vê o assunto, o texto, o nome
        e o e-mail de quem pediu. Nada mais do espaço dessa pessoa aparece. Responda por e-mail,
        fora do SIESAL, e depois marque como atendido.
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
              const rotulo = `${p.nome}, ${ASSUNTO[p.assunto] ?? 'Outro assunto'}`;
              return (
                <li key={p.pedido_id} className="ops-pessoa">
                  <strong>{ASSUNTO[p.assunto] ?? 'Outro assunto'}</strong>
                  <br />
                  <span className="small muted">
                    {p.nome} · {p.email}
                  </span>
                  <blockquote>{p.texto}</blockquote>
                  <span className="small">Pediu {quandoPediu(p.criado_em)}</span>{' '}
                  <span
                    className="suporte-barra"
                    aria-hidden="true"
                    title={`Esperando há ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
                  >
                    <span style={{ width: `${Math.min(100, (dias / DIAS_DA_BARRA) * 100)}%` }} />
                  </span>
                  <br />
                  {confirmando === p.pedido_id ? (
                    <span>
                      <span className="small">Você já respondeu a esta pessoa?</span>{' '}
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => void marcar(p)}
                      >
                        Sim, marcar como atendido
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setConfirmando(null)}
                      >
                        Não
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Marcar como atendido: ${rotulo}`}
                      className="btn btn-outline btn-sm"
                      onClick={() => setConfirmando(p.pedido_id)}
                    >
                      Marcar como atendido
                    </button>
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

// Console do Master: quem indica e retira o Admin atendente. Nada é apagado; retirar corta o acesso na hora.
export function AtendentesSuporte({ aoSair }: { aoSair: () => void }) {
  const [admins, setAdmins] = useState<CandidatoAtendente[] | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState('');
  const titulo = useRef<HTMLHeadingElement>(null);

  const ler = useCallback(async () => {
    try {
      setAdmins((await apiOperacao.atendentes()).admins);
    } catch (x) {
      if (x instanceof ErroApi && x.status === 401) return aoSair();
      setErro(mensagem(x, 'Não foi possível listar os Admins.'));
    }
  }, [aoSair]);
  useEffect(() => {
    void ler();
  }, [ler]);

  async function mudar(a: CandidatoAtendente) {
    setErro('');
    setFeito('');
    try {
      if (a.indicado) {
        await apiOperacao.retirarAtendente(a.instituicao_id, a.usuario_id);
        setFeito(`${a.nome} deixou de atender o suporte dos espaços. O acesso foi cortado.`);
      } else {
        await apiOperacao.indicarAtendente(a.instituicao_id, a.usuario_id);
        setFeito(`${a.nome} agora atende o suporte dos espaços individuais.`);
      }
    } catch (x) {
      setErro(mensagem(x, 'Não foi possível salvar.'));
    }
    setConfirmando(null);
    await ler();
    titulo.current?.focus();
  }

  const indicados = admins?.filter((a) => a.indicado).length ?? 0;
  return (
    <section className="card" aria-labelledby="atend-titulo">
      <div className="card-head">
        <h1 id="atend-titulo" ref={titulo} tabIndex={-1} style={{ fontSize: 22 }}>
          Atendentes do suporte
        </h1>
      </div>
      <p className="muted small">
        O Admin indicado aqui lê os pedidos de suporte dos espaços individuais (nome, e-mail,
        assunto e texto) e marca como atendido. Se ele for desativado ou a escola deixar de estar
        ativa, a indicação para de valer sozinha. Cada abertura da fila fica na auditoria.
      </p>
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      <div role="status">{feito ? <Aviso>{feito}</Aviso> : null}</div>
      {admins === null ? (
        erro ? null : (
          <p role="status">Carregando…</p>
        )
      ) : admins.length === 0 ? (
        <p>Nenhum Admin ativo em escola ativa.</p>
      ) : (
        <>
          <p>
            <strong>{indicados}</strong> {indicados === 1 ? 'Admin indicado' : 'Admins indicados'}{' '}
            de {admins.length}.
          </p>
          <ul className="ops-pessoas" aria-label="Admins das escolas ativas">
            {admins.map((a) => {
              const chave = `${a.instituicao_id}:${a.usuario_id}`;
              return (
                <li key={chave} className="ops-pessoa">
                  <strong>{a.nome}</strong>
                  <br />
                  <span className="small muted">
                    {a.email} · {a.instituicao_nome}
                  </span>
                  <br />
                  <span className="small">
                    {a.indicado ? 'Indicado como atendente' : 'Não indicado'}
                  </span>
                  <br />
                  {confirmando === chave ? (
                    <span>
                      <span className="small">
                        {a.indicado
                          ? 'Retirar a indicação? O acesso à fila é cortado na hora.'
                          : 'Indicar este Admin? Ele passa a ler nome, e-mail e texto dos pedidos.'}
                      </span>{' '}
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => void mudar(a)}
                      >
                        {a.indicado ? 'Sim, retirar' : 'Sim, indicar'}
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setConfirmando(null)}
                      >
                        Não
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`${a.indicado ? 'Retirar' : 'Indicar'} ${a.nome} (${a.instituicao_nome})`}
                      className="btn btn-outline btn-sm"
                      onClick={() => setConfirmando(chave)}
                    >
                      {a.indicado ? 'Retirar' : 'Indicar'}
                    </button>
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
