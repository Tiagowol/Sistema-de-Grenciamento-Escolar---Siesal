import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, ErroApi, type NotaOficial, type Perfil } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Titulo, Vazio } from '../componentes/Basicos';
import {
  CampoTexto,
  EstadoDoPedido,
  fraseDoEstado,
  Historico,
  nota1,
  ValorDaNota,
} from '../componentes/NotasComuns';
import { TempoVisual } from '../componentes/TempoVisual';
import { useCarregar } from '../componentes/useCarregar';
import { formatar, paraTexto } from '../datas';

const TEXTOS: Record<string, { olho: string; titulo: string; sub: string }> = {
  aluno: {
    olho: 'Seu acompanhamento',
    titulo: 'Minhas notas oficiais',
    sub: 'Notas lançadas pelos professores. Você vê só as suas.',
  },
  responsavel: {
    olho: 'Acompanhamento',
    titulo: 'Notas oficiais do aluno',
    sub: 'Notas lançadas pelos professores do aluno que você acompanha.',
  },
  admin: {
    olho: 'Administração',
    titulo: 'Notas oficiais da instituição',
    sub: 'Leitura. Quem altera uma nota é o professor que a lançou.',
  },
  pedagogico: {
    olho: 'Pedagógico e apoio',
    titulo: 'Notas oficiais da instituição',
    sub: 'Leitura da nota atual. Quem altera uma nota é o professor que a lançou.',
  },
};

// Leitura das notas oficiais e pedido de revisão (aluno, responsável, Admin, Pedagógico/Apoio).
// Sem ranking, sem média da turma e sem comparação entre alunos.
export function NotasOficiais({ perfil }: { perfil: Perfil }) {
  const notas = useCarregar(api.notasOficiais);
  const pedidos = useCarregar(api.pedidosRevisao);
  const hoje = paraTexto(new Date());
  const [aberto, setAberto] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const t = TEXTOS[perfil] ?? TEXTOS.aluno;
  const lista = notas.dados?.notas ?? [];
  const meus = pedidos.dados?.pedidos ?? [];

  async function pedir(e: FormEvent, n: NotaOficial) {
    e.preventDefault();
    setOk('');
    if (!texto.trim()) return setErro('Escreva o que você gostaria que o professor visse.');
    try {
      await api.pedirRevisao(n.id, texto.trim());
      setErro('');
      setOk('Pedido enviado. O professor vai ler e decidir.');
      setAberto(null);
      setTexto('');
      await Promise.all([notas.recarregar(), pedidos.recarregar()]);
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível enviar o pedido.');
    }
  }

  return (
    <div className="pag-notas">
      <Titulo olho={t?.olho ?? ''} titulo={t?.titulo ?? ''} sub={t?.sub ?? ''} />
      <Aviso>
        Se você acha que uma nota precisa de uma nova olhada, peça uma revisão. Pedir não muda a
        nota. O professor lê o pedido e decide.
      </Aviso>
      {notas.erro ? <Aviso tipo="warn">{notas.erro}</Aviso> : null}
      {pedidos.erro ? <Aviso tipo="warn">{pedidos.erro}</Aviso> : null}
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {ok ? <Aviso>{ok}</Aviso> : null}

      <section className="card mt" aria-labelledby="h-notas-of">
        <div className="card-head">
          <h2 id="h-notas-of">Notas</h2>
        </div>
        {notas.dados && lista.length === 0 ? (
          <Vazio>Nenhuma nota oficial lançada ainda.</Vazio>
        ) : (
          <ul className="lista-adm">
            {lista.map((n) => (
              <li key={n.id}>
                <div className="lista-adm-texto">
                  <strong>{n.disciplina_nome}</strong>
                  {n.descricao ? ` · ${n.descricao}` : ''}
                  {perfil !== 'aluno' ? <div className="small">Aluno: {n.aluno_nome}</div> : null}
                  <div className="small muted">
                    Turma {n.turma_nome} · <TempoVisual prazo={n.dia} hoje={hoje} passado />
                  </div>
                  <ValorDaNota valor={n.valor} rotulo={`Nota de ${n.disciplina_nome}`} />
                  {n.versoes ? <Historico versoes={n.versoes} /> : null}
                  {aberto === n.id ? (
                    <form className="form-inline" onSubmit={(e) => void pedir(e, n)} noValidate>
                      <p className="small muted">
                        Nota atual: {nota1(n.valor)}. O pedido tem texto curto, sem links nem
                        anexos.
                      </p>
                      <CampoTexto
                        rotulo="O que você gostaria que o professor visse?"
                        valor={texto}
                        aoMudar={setTexto}
                        limite={300}
                      />
                      <div className="blocos">
                        <button type="submit" className="btn btn-primary">
                          Enviar pedido de revisão
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => setAberto(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
                {n.pedido_aberto_meu ? (
                  <span className="small">Pedido aberto. Aguardando o professor.</span>
                ) : aberto !== n.id ? (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setAberto(n.id);
                      setTexto('');
                      setErro('');
                    }}
                  >
                    Pedir revisão
                    <span className="sr-only">
                      {' '}
                      da nota de {n.disciplina_nome} em {formatar(n.dia)}
                    </span>
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt" aria-labelledby="h-meus-pedidos">
        <div className="card-head">
          <h2 id="h-meus-pedidos">Meus pedidos de revisão</h2>
        </div>
        {pedidos.dados && meus.length === 0 ? (
          <Vazio>Você ainda não fez nenhum pedido.</Vazio>
        ) : (
          <ul className="lista-adm">
            {meus.map((p) => (
              <li key={p.id}>
                <div className="lista-adm-texto">
                  <strong>{p.disciplina_nome}</strong>
                  {p.nota_descricao ? ` · ${p.nota_descricao}` : ''}
                  {perfil !== 'aluno' ? <div className="small">Aluno: {p.aluno_nome}</div> : null}
                  <div className="small muted">
                    Pedido em {formatar(p.criado_em)} · nota atual {nota1(p.valor_atual)}
                  </div>
                  <p>“{p.texto}”</p>
                  <div>
                    <EstadoDoPedido estado={p.estado} />{' '}
                    <span className="small">
                      {fraseDoEstado(p.estado)}
                      {p.respondido_em ? ` Em ${formatar(p.respondido_em)}.` : ''}
                    </span>
                  </div>
                  {p.motivo_resposta ? (
                    <div className="small muted">Motivo do professor: {p.motivo_resposta}</div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
