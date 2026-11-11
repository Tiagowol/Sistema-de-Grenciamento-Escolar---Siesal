import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, ErroApi, type Evento } from '../api';
import { blocoDe } from '../blocos';
import { Aviso } from '../componentes/Aviso';
import { Kpi, Titulo, Vazio } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import { tempoVisualLigado } from '../componentes/TempoVisual';
import { useCarregar } from '../componentes/useCarregar';
import {
  dataLonga,
  formatar,
  type ParteDoDia,
  paraData,
  paraTexto,
  parteDoDia,
  semanaDe,
  somarDias,
} from '../datas';
import { NOMES_TIPO, nomeDoTipo } from '../eventos';
import { Icone, type NomeIcone } from '../icones';
import { texto } from '../linguagem-curta';

// Parte do dia com nome e ícone; a hora exata é só um detalhe
const PARTES: Record<ParteDoDia, { nome: string; icone: NomeIcone }> = {
  manha: { nome: 'Manhã', icone: 'sun' },
  tarde: { nome: 'Tarde', icone: 'sunset' },
  noite: { nome: 'Noite', icone: 'moon' },
};

function EventoHora({ hora, visual }: { hora: string | null; visual: boolean }) {
  const parte = visual ? parteDoDia(hora) : null;
  if (!parte) return <div className="event-time">{hora ?? '—'}</div>;
  const p = PARTES[parte];
  return (
    <div className="event-time parte">
      <Icone nome={p.icone} />
      <span>{p.nome}</span>
      <small>{hora}</small>
    </div>
  );
}

export function Agenda() {
  const [visual] = useState(tempoVisualLigado);
  const hoje = paraTexto(new Date());
  const [base, setBase] = useState(hoje);
  const [selecionado, setSelecionado] = useState(hoje);
  // Troca de semana: o dia selecionado anda junto e continua dentro da semana mostrada
  const mudarSemana = (n: number) => {
    setBase(somarDias(base, n));
    setSelecionado(somarDias(selecionado, n));
  };
  const semana = semanaDe(base);
  const { dados, erro, recarregar } = useCarregar(
    () => api.eventos(semana[0] as string, semana[6] as string),
    [base],
  );
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<Evento['tipo']>('pessoal');
  const [hora, setHora] = useState('');
  const [msg, setMsg] = useState('');

  const eventos = dados?.eventos ?? [];
  const doDia = eventos.filter((e) => e.dia === selecionado);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    if (!titulo.trim()) return setMsg('Escreva o nome do compromisso.');
    try {
      await api.criarEvento({
        titulo: titulo.trim(),
        tipo,
        dia: selecionado,
        hora_inicio: hora || null,
      });
      setTitulo('');
      setHora('');
      await recarregar();
    } catch (x) {
      setMsg(x instanceof ErroApi ? x.message : 'Não foi possível salvar.');
    }
  }

  return (
    <>
      <Titulo olho="Seu tempo" titulo={texto('agendaTitulo')} sub={texto('agendaSub')} />
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      <div className="grid cols-3">
        <Kpi
          numero={eventos.length}
          rotulo="Compromissos na semana"
          nota="Incluindo blocos de estudo"
          icone="calendar"
          tom="blue"
        />
        <Kpi
          numero={eventos.filter((e) => e.origem === 'plano').length}
          rotulo="Blocos do plano"
          nota="Montados a partir dos prazos"
          icone="clock"
          tom="teal"
        />
        <Kpi
          numero={eventos.filter((e) => e.tipo === 'prova').length}
          rotulo="Provas na semana"
          nota="Planeje com antecedência"
          icone="tasks"
          tom="amber"
        />
      </div>
      <div className="layout mt">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>
                Semana de {formatar(semana[0] as string)} a {formatar(semana[6] as string)}
              </h2>
              <small>Selecione um dia para ver os detalhes.</small>
            </div>
            <div className="chip-row">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => mudarSemana(-7)}
              >
                Anterior
              </button>
              <button
                type="button"
                className="btn btn-soft btn-sm"
                onClick={() => {
                  setBase(hoje);
                  setSelecionado(hoje);
                }}
              >
                Hoje
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => mudarSemana(7)}
              >
                Próxima
              </button>
            </div>
          </div>
          <div className="week-header">
            {semana.map((d) => {
              const tem = eventos.some((e) => e.dia === d);
              const nome = paraData(d)
                .toLocaleDateString('pt-BR', { weekday: 'short' })
                .replace('.', '');
              return (
                <button
                  key={d}
                  type="button"
                  className={`day${d === hoje ? ' today' : ''}${d === selecionado ? ' active' : ''}`}
                  aria-pressed={d === selecionado}
                  aria-label={`${dataLonga(d)}${tem ? ', tem compromisso' : ''}`}
                  onClick={() => setSelecionado(d)}
                >
                  <small>{nome}</small>
                  <b>{paraData(d).getDate()}</b>
                  {tem ? (
                    <span className="day-dot" />
                  ) : (
                    <span style={{ display: 'inline-block', height: 6 }} />
                  )}
                </button>
              );
            })}
          </div>
          <hr className="divider" />
          <h3>{dataLonga(selecionado)}</h3>
          <div className="mt-sm">
            {doDia.length === 0 ? (
              <Vazio>
                Sem compromissos neste dia. Um espaço livre também faz parte de um plano.
              </Vazio>
            ) : (
              doDia.map((e) => (
                <div
                  key={e.id}
                  className={`event${e.tipo === 'estudo' ? ' event-study' : ''}${e.tipo === 'pessoal' ? ' event-personal' : ''}`}
                >
                  <EventoHora hora={e.hora_inicio} visual={visual} />
                  <div className="event-marker" />
                  <div className="event-body">
                    <div className="event-title">{e.titulo}</div>
                    <div className="event-sub">
                      {nomeDoTipo(e.tipo)}
                      {e.minutos
                        ? ` · Bloco ${blocoDe(e.minutos).nome.toLowerCase()} (${e.minutos} min)`
                        : ''}
                      {e.origem === 'plano' ? ' · do seu plano' : ''}
                      {e.origem === 'calendario_escolar' ? ' · do calendário da escola' : ''}
                    </div>
                  </div>
                  {e.origem === 'calendario_escolar' && e.item_id ? (
                    // Item da escola (L19): o aluno não remove, só oculta para si
                    <button
                      type="button"
                      className="small-link"
                      onClick={async () => {
                        await api.ocultarItemEscolar(e.item_id as string);
                        await recarregar();
                      }}
                    >
                      Ocultar<span className="sr-only"> {e.titulo}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="small-link"
                      onClick={async () => {
                        await api.removerEvento(e.id);
                        await recarregar();
                      }}
                    >
                      Remover<span className="sr-only"> {e.titulo}</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        <form className="card" onSubmit={criar} noValidate aria-labelledby="novo-ev">
          <h2 id="novo-ev">Novo compromisso</h2>
          <p className="muted small mt-sm">Será criado em {dataLonga(selecionado)}.</p>
          {msg ? <Aviso tipo="warn">{msg}</Aviso> : null}
          <div className="stack mt-sm">
            <Campo rotulo="Nome">
              {({ id }) => (
                <input
                  id={id}
                  value={titulo}
                  maxLength={120}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              )}
            </Campo>
            <Campo rotulo="Tipo">
              {({ id }) => (
                <select
                  id={id}
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as Evento['tipo'])}
                >
                  {Object.entries(NOMES_TIPO).map(([v, n]) => (
                    <option key={v} value={v}>
                      {n}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Horário (opcional)">
              {({ id }) => (
                <input id={id} type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              )}
            </Campo>
            <button type="submit" className="btn btn-primary">
              <Icone nome="plus" /> Salvar compromisso
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
