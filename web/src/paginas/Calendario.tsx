import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, ErroApi, type Evento, type TipoAtividade } from '../api';
import { BLOCOS, blocoDe } from '../blocos';
import { Aviso } from '../componentes/Aviso';
import { Titulo, Vazio } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import { TempoVisual } from '../componentes/TempoVisual';
import { useCarregar } from '../componentes/useCarregar';
import {
  dataLonga,
  formatar,
  type ParteDoDia,
  paraData,
  paraTexto,
  parteDoDia,
  relativo,
  semanaDe,
  somarDias,
} from '../datas';
import { NOMES_TIPO, nomeDoTipo, podeEditar, podeRemover, SELO_ORIGEM } from '../eventos';
import { Icone, type NomeIcone } from '../icones';

export type Visao = 'dia' | 'semana' | 'mes' | 'ano';
const VISOES: { id: Visao; nome: string }[] = [
  { id: 'dia', nome: 'Dia' },
  { id: 'semana', nome: 'Semana' },
  { id: 'mes', nome: 'Mês' },
  { id: 'ano', nome: 'Ano' },
];
const PARTES: Record<ParteDoDia | 'sem', { nome: string; icone: NomeIcone | null }> = {
  manha: { nome: 'Manhã', icone: 'sun' },
  tarde: { nome: 'Tarde', icone: 'sunset' },
  noite: { nome: 'Noite', icone: 'moon' },
  sem: { nome: 'Sem horário', icone: null },
};
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

const primeiroDoMes = (dia: string) => `${dia.slice(0, 8)}01`;
const ultimoDoMes = (dia: string) => {
  const d = paraData(primeiroDoMes(dia));
  d.setMonth(d.getMonth() + 1, 0);
  return paraTexto(d);
};
const mesesAfora = (dia: string, n: number) => {
  const d = paraData(primeiroDoMes(dia));
  d.setMonth(d.getMonth() + n, 1);
  return paraTexto(d);
};

// Intervalo que a visão precisa carregar. O mês inclui as semanas cheias que aparecem na grade.
export function intervalo(visao: Visao, base: string): [string, string] {
  if (visao === 'dia') return [base, base];
  if (visao === 'semana') {
    const s = semanaDe(base);
    return [s[0] as string, s[6] as string];
  }
  if (visao === 'mes') {
    return [semanaDe(primeiroDoMes(base))[0] as string, semanaDe(ultimoDoMes(base))[6] as string];
  }
  return [`${base.slice(0, 4)}-01-01`, `${base.slice(0, 4)}-12-31`];
}

// Anda uma unidade da visão para trás (-1) ou para a frente (+1)
export function andar(visao: Visao, base: string, n: number): string {
  if (visao === 'dia') return somarDias(base, n);
  if (visao === 'semana') return somarDias(base, 7 * n);
  if (visao === 'mes') return mesesAfora(base, n);
  return `${Number(base.slice(0, 4)) + n}${base.slice(4)}`;
}

function nomeDaVisao(visao: Visao, base: string): string {
  if (visao === 'dia') return dataLonga(base);
  if (visao === 'semana') {
    const s = semanaDe(base);
    return `Semana de ${formatar(s[0] as string)} a ${formatar(s[6] as string)}`;
  }
  if (visao === 'mes') return `${MESES[paraData(base).getMonth()]} de ${base.slice(0, 4)}`;
  return `Ano de ${base.slice(0, 4)}`;
}

type Rascunho = {
  id: string | null;
  titulo: string;
  tipo: Evento['tipo'];
  dia: string;
  hora: string;
  minutos: number | null;
  tipoAtividade: string;
};

const plural = (n: number) => (n === 1 ? 'entrada' : 'entradas');

export function Calendario() {
  const hoje = paraTexto(new Date());
  const [visao, setVisao] = useState<Visao>('mes');
  const [base, setBase] = useState(hoje);
  const [de, ate] = intervalo(visao, base);
  const { dados, erro, recarregar } = useCarregar(() => api.eventos(de, ate), [visao, base]);
  const eventos = dados?.eventos ?? [];
  const tipos = useCarregar(api.tiposAtividade).dados?.tipos ?? [];
  const tipoDe = (id?: string | null): TipoAtividade | undefined => tipos.find((t) => t.id === id);
  const [msg, setMsg] = useState('');
  const vazio: Rascunho = {
    id: null,
    titulo: '',
    tipo: 'compromisso',
    dia: base,
    hora: '',
    minutos: null,
    tipoAtividade: '',
  };
  const [rascunho, setRascunho] = useState<Rascunho>(vazio);

  const doDia = (d: string) => eventos.filter((e) => e.dia === d);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    if (!rascunho.titulo.trim()) return setMsg('Escreva o nome da entrada.');
    const corpo = {
      titulo: rascunho.titulo.trim(),
      tipo: rascunho.tipo,
      dia: rascunho.dia,
      hora_inicio: rascunho.hora || null,
      minutos: rascunho.minutos,
      tipo_atividade_id: rascunho.tipoAtividade || null,
    };
    try {
      if (rascunho.id) await api.editarEvento(rascunho.id, corpo);
      else await api.criarEvento(corpo);
      setRascunho({ ...vazio, dia: rascunho.dia });
      await recarregar();
    } catch (x) {
      setMsg(x instanceof ErroApi ? x.message : 'Não foi possível salvar.');
    }
  }

  const escolherDia = (d: string) => {
    setBase(d);
    setRascunho((r) => (r.id ? r : { ...r, dia: d }));
  };

  function linha(e: Evento) {
    const parte = parteDoDia(e.hora_inicio);
    const p = PARTES[parte ?? 'sem'];
    const selo = SELO_ORIGEM[e.origem];
    return (
      <li className="cal-evento" key={e.id}>
        <div className="cal-parte">
          {p.icone ? <Icone nome={p.icone} /> : null}
          <span>{p.nome}</span>
          {e.hora_inicio ? <small>{e.hora_inicio}</small> : null}
        </div>
        <div className="cal-corpo">
          <strong>{e.titulo}</strong>
          <div className="small muted">
            {nomeDoTipo(e.tipo)}
            {e.turma_nome ? ` · Turma ${e.turma_nome}` : ''}
            {e.minutos
              ? ` · Bloco ${blocoDe(e.minutos).nome.toLowerCase()} (${e.minutos} min)`
              : ''}
            {tipoDe(e.tipo_atividade_id) ? (
              <span className="cal-selo">{tipoDe(e.tipo_atividade_id)?.nome}</span>
            ) : null}
            {selo ? <span className="cal-selo">{selo}</span> : null}
          </div>
          <div className="small">
            <TempoVisual prazo={e.dia} hoje={hoje} />
          </div>
        </div>
        <div className="cal-acoes">
          {podeEditar(e) ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() =>
                setRascunho({
                  id: e.id,
                  titulo: e.titulo,
                  tipo: e.tipo,
                  dia: e.dia,
                  hora: e.hora_inicio ?? '',
                  minutos: e.minutos,
                  tipoAtividade: e.tipo_atividade_id ?? '',
                })
              }
            >
              Editar<span className="sr-only"> {e.titulo}</span>
            </button>
          ) : null}
          {podeRemover(e) ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={async () => {
                await api.removerEvento(e.id);
                await recarregar();
              }}
            >
              Remover<span className="sr-only"> {e.titulo}</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={async () => {
                // Item da escola (L19) se oculta pelo item; o evento do aluno, pelo próprio id
                if (e.origem === 'calendario_escolar' && e.item_id)
                  await api.ocultarItemEscolar(e.item_id);
                else await api.ocultarEvento(e.id);
                await recarregar();
              }}
            >
              Ocultar<span className="sr-only"> {e.titulo}</span>
            </button>
          )}
        </div>
      </li>
    );
  }

  function listaDoDia(d: string) {
    const itens = doDia(d);
    return itens.length === 0 ? (
      <Vazio>Nada marcado neste dia.</Vazio>
    ) : (
      <ul className="cal-lista">{itens.map(linha)}</ul>
    );
  }

  function celula(d: string, fora: boolean) {
    const n = doDia(d).length;
    return (
      <button
        key={d}
        type="button"
        className={`cal-celula${d === hoje ? ' hoje' : ''}${d === base ? ' ativo' : ''}${fora ? ' fora' : ''}`}
        aria-pressed={d === base}
        aria-label={`${dataLonga(d)}, ${relativo(d, hoje)}, ${n ? `${n} ${plural(n)}` : 'sem entradas'}`}
        onClick={() => escolherDia(d)}
      >
        <b>{paraData(d).getDate()}</b>
        {n ? (
          <span className="cal-pontos" aria-hidden="true">
            {'■'.repeat(Math.min(n, 3))}
          </span>
        ) : null}
      </button>
    );
  }

  const [ini, fim] = intervalo('mes', base);
  const diasMes: string[] = [];
  for (let d = ini; d <= fim; d = somarDias(d, 1)) diasMes.push(d);
  const nomeVisao = VISOES.find((v) => v.id === visao)?.nome.toLowerCase();

  return (
    <>
      <Titulo
        olho="Seu tempo"
        titulo="Calendário"
        sub="Veja o dia, a semana, o mês ou o ano. Escolha o que quer ver."
      />
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      <div className="layout mt">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>{nomeDaVisao(visao, base)}</h2>
              <small>
                {relativo(base, hoje)} · {formatar(base)}
              </small>
            </div>
            <div className="chip-row">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setBase(andar(visao, base, -1))}
              >
                Anterior
              </button>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setBase(hoje)}>
                Hoje
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setBase(andar(visao, base, 1))}
              >
                Próximo
              </button>
            </div>
          </div>
          <fieldset className="chip-row cal-visoes">
            <legend className="sr-only">Forma de ver o calendário</legend>
            {VISOES.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`btn btn-sm ${visao === v.id ? 'btn-primary' : 'btn-outline'}`}
                aria-pressed={visao === v.id}
                onClick={() => setVisao(v.id)}
              >
                {v.nome}
              </button>
            ))}
          </fieldset>
          <p className="sr-only" role="status" aria-live="polite">
            Visão {nomeVisao}: {nomeDaVisao(visao, base)}.
          </p>
          <hr className="divider" />

          {visao === 'dia' ? listaDoDia(base) : null}

          {visao === 'semana' ? (
            <div className="cal-semana">
              {semanaDe(base).map((d) => (
                <section key={d} aria-label={dataLonga(d)}>
                  <h3>
                    {dataLonga(d)} <small className="muted">· {relativo(d, hoje)}</small>
                  </h3>
                  {listaDoDia(d)}
                </section>
              ))}
            </div>
          ) : null}

          {visao === 'mes' ? (
            <>
              <div className="cal-grade">
                {DIAS_SEMANA.map((n) => (
                  <small key={n} className="cal-cab">
                    {n}
                  </small>
                ))}
                {diasMes.map((d) => celula(d, d.slice(0, 7) !== base.slice(0, 7)))}
              </div>
              <h3 className="mt">{dataLonga(base)}</h3>
              {listaDoDia(base)}
            </>
          ) : null}

          {visao === 'ano' ? (
            <ul className="cal-ano">
              {MESES.map((nome, i) => {
                const prefixo = `${base.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`;
                const n = eventos.filter((e) => e.dia.startsWith(prefixo)).length;
                return (
                  <li key={nome}>
                    <button
                      type="button"
                      className="btn btn-outline cal-mes"
                      onClick={() => {
                        setBase(`${prefixo}-01`);
                        setVisao('mes');
                      }}
                    >
                      <b>{nome}</b>
                      <span>{n === 0 ? 'Sem entradas' : `${n} ${plural(n)}`}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <form className="card" onSubmit={salvar} noValidate aria-labelledby="cal-novo">
          <h2 id="cal-novo">{rascunho.id ? 'Editar entrada' : 'Nova entrada'}</h2>
          <p className="muted small mt-sm">Dia escolhido: {dataLonga(rascunho.dia)}.</p>
          {msg ? <Aviso tipo="warn">{msg}</Aviso> : null}
          <div className="stack mt-sm">
            <Campo rotulo="Nome">
              {({ id }) => (
                <input
                  id={id}
                  value={rascunho.titulo}
                  maxLength={120}
                  onChange={(e) => setRascunho({ ...rascunho, titulo: e.target.value })}
                />
              )}
            </Campo>
            <Campo rotulo="Tipo">
              {({ id }) => (
                <select
                  id={id}
                  value={rascunho.tipo}
                  onChange={(e) =>
                    setRascunho({ ...rascunho, tipo: e.target.value as Evento['tipo'] })
                  }
                >
                  {Object.entries(NOMES_TIPO).map(([v, n]) => (
                    <option key={v} value={v}>
                      {n}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            {tipos.length > 0 ? (
              <Campo rotulo="Seu tipo de atividade (opcional)">
                {({ id }) => (
                  <select
                    id={id}
                    value={rascunho.tipoAtividade}
                    onChange={(e) => setRascunho({ ...rascunho, tipoAtividade: e.target.value })}
                  >
                    <option value="">Nenhum</option>
                    {tipos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
            ) : null}
            <Campo rotulo="Dia">
              {({ id }) => (
                <input
                  id={id}
                  type="date"
                  value={rascunho.dia}
                  onChange={(e) =>
                    e.target.value && setRascunho({ ...rascunho, dia: e.target.value })
                  }
                />
              )}
            </Campo>
            <Campo rotulo="Horário (opcional)">
              {({ id }) => (
                <input
                  id={id}
                  type="time"
                  value={rascunho.hora}
                  onChange={(e) => setRascunho({ ...rascunho, hora: e.target.value })}
                />
              )}
            </Campo>
            <fieldset className="field">
              <legend>Duração (opcional)</legend>
              <div className="chip-row">
                <button
                  type="button"
                  className={`btn btn-sm ${rascunho.minutos === null ? 'btn-primary' : 'btn-outline'}`}
                  aria-pressed={rascunho.minutos === null}
                  onClick={() => setRascunho({ ...rascunho, minutos: null })}
                >
                  Sem duração
                </button>
                {BLOCOS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`btn btn-sm ${rascunho.minutos === b.minutos ? 'btn-primary' : 'btn-outline'}`}
                    aria-pressed={rascunho.minutos === b.minutos}
                    onClick={() => setRascunho({ ...rascunho, minutos: b.minutos })}
                  >
                    {b.nome} <small>({b.minutos} min)</small>
                  </button>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="btn btn-primary">
              <Icone nome="plus" /> {rascunho.id ? 'Salvar alterações' : 'Salvar entrada'}
            </button>
            {rascunho.id ? (
              <button type="button" className="btn btn-outline" onClick={() => setRascunho(vazio)}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </>
  );
}
