import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, ErroApi, type Tarefa } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Pill, Progresso, Titulo, Vazio } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import { useCarregar } from '../componentes/useCarregar';
import { formatar, paraTexto, relativo } from '../datas';
import { Icone } from '../icones';

type Filtro = 'todas' | 'atrasadas' | 'andamento' | 'comecar' | 'concluidas';
const FILTROS: [Filtro, string][] = [
  ['todas', 'Todas'],
  ['atrasadas', 'Atrasadas'],
  ['andamento', 'Em andamento'],
  ['comecar', 'Para começar'],
  ['concluidas', 'Concluídas'],
];

const percentual = (t: Tarefa) => {
  if (t.situacao === 'concluida') return 100;
  return t.microetapas.length
    ? Math.round((t.microetapas.filter((m) => m.feita).length / t.microetapas.length) * 100)
    : 0;
};

function situacaoDe(
  t: Tarefa,
  hoje: string,
): { texto: string; tom: 'teal' | 'red' | 'amber' | 'blue' | 'purple' } {
  if (t.situacao === 'concluida') return { texto: 'Concluída', tom: 'teal' };
  if (t.prazo && t.prazo < hoje) return { texto: 'Atrasada', tom: 'red' };
  if (t.prazo && t.prazo <= paraTexto(new Date(Date.parse(`${hoje}T12:00:00`) + 2 * 86_400_000)))
    return { texto: 'Prazo próximo', tom: 'amber' };
  if (percentual(t) > 0 || t.situacao === 'em_andamento')
    return { texto: 'Em andamento', tom: 'blue' };
  return { texto: 'Não iniciada', tom: 'purple' };
}

function NovaAtividade({ aoCriar }: { aoCriar: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [disciplina, setDisciplina] = useState('');
  const [prazo, setPrazo] = useState('');
  const [tipo, setTipo] = useState<Tarefa['tipo']>('tarefa');
  const [prioridade, setPrioridade] = useState<Tarefa['prioridade']>('media');
  const [etapas, setEtapas] = useState('');
  const [erro, setErro] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!titulo.trim()) return setErro('Escreva o nome da atividade.');
    try {
      await api.criarTarefa({
        titulo: titulo.trim(),
        disciplina: disciplina.trim(),
        tipo,
        prioridade,
        prazo: prazo || null,
        microetapas: etapas
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 20),
      });
      setTitulo('');
      setDisciplina('');
      setPrazo('');
      setEtapas('');
      aoCriar();
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível salvar.');
    }
  }

  return (
    <form className="card" onSubmit={enviar} noValidate aria-labelledby="nova-ativ">
      <div className="card-head">
        <div>
          <h2 id="nova-ativ">Nova atividade</h2>
          <small>Só o nome é obrigatório. O resto você pode completar depois.</small>
        </div>
      </div>
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      <div className="form-grid">
        <Campo rotulo="Nome da atividade" cheio>
          {({ id }) => (
            <input
              id={id}
              value={titulo}
              maxLength={120}
              onChange={(e) => setTitulo(e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Disciplina (opcional)">
          {({ id }) => (
            <input
              id={id}
              value={disciplina}
              maxLength={80}
              onChange={(e) => setDisciplina(e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Prazo (opcional)">
          {({ id }) => (
            <input id={id} type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          )}
        </Campo>
        <Campo rotulo="Tipo">
          {({ id }) => (
            <select
              id={id}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as Tarefa['tipo'])}
            >
              <option value="tarefa">Tarefa</option>
              <option value="trabalho">Trabalho</option>
              <option value="prova">Prova</option>
              <option value="leitura">Leitura</option>
            </select>
          )}
        </Campo>
        <Campo rotulo="Prioridade">
          {({ id }) => (
            <select
              id={id}
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value as Tarefa['prioridade'])}
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          )}
        </Campo>
        <Campo
          rotulo="Pequenas etapas (uma por linha, opcional)"
          dica="Exemplo: ler o capítulo; fazer os tópicos; revisar."
          cheio
        >
          {({ id, descricao }) => (
            <textarea
              id={id}
              aria-describedby={descricao}
              rows={3}
              value={etapas}
              onChange={(e) => setEtapas(e.target.value)}
            />
          )}
        </Campo>
      </div>
      <button type="submit" className="btn btn-primary mt-sm">
        <Icone nome="plus" /> Salvar atividade
      </button>
    </form>
  );
}

function Planejar({ tarefa, aoPlanejar }: { tarefa: Tarefa; aoPlanejar: () => void }) {
  const [total, setTotal] = useState(120);
  const [sessao, setSessao] = useState(25);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  async function gerar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setMsg('');
    try {
      const r = await api.planejar(tarefa.id, { minutos_total: total, minutos_por_sessao: sessao });
      setMsg(
        `Plano criado: ${r.blocos.length} blocos de estudo, do dia ${formatar(r.blocos[0]?.dia ?? '')} ao dia ${formatar(r.blocos.at(-1)?.dia ?? '')}. Veja na agenda.`,
      );
      aoPlanejar();
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível montar o plano.');
    }
  }
  return (
    <form onSubmit={gerar} noValidate aria-label={`Plano de estudo de ${tarefa.titulo}`}>
      <h3>Montar plano até o prazo</h3>
      {tarefa.prazo ? null : (
        <Aviso>Defina um prazo para esta atividade antes de montar o plano.</Aviso>
      )}
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {msg ? <Aviso>{msg}</Aviso> : null}
      <div className="form-grid">
        <Campo rotulo="Tempo total de estudo (minutos)">
          {({ id }) => (
            <input
              id={id}
              type="number"
              min={5}
              max={6000}
              value={total}
              onChange={(e) => setTotal(Number(e.target.value))}
            />
          )}
        </Campo>
        <Campo rotulo="Tempo de cada bloco (minutos)">
          {({ id }) => (
            <input
              id={id}
              type="number"
              min={5}
              max={180}
              value={sessao}
              onChange={(e) => setSessao(Number(e.target.value))}
            />
          )}
        </Campo>
      </div>
      <button type="submit" className="btn btn-soft btn-sm mt-sm" disabled={!tarefa.prazo}>
        Montar plano
      </button>
    </form>
  );
}

function Detalhe({ t, aoMudar }: { t: Tarefa; aoMudar: () => void }) {
  const [nova, setNova] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState('');
  const agir = async (f: () => Promise<unknown>) => {
    setErro('');
    try {
      await f();
      aoMudar();
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível concluir.');
    }
  };
  return (
    <div className="card slim" style={{ marginTop: 10 }}>
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      <h3>Etapas</h3>
      {t.microetapas.length ? (
        t.microetapas.map((m) => (
          <div key={m.id} className={`step${m.feita ? ' done' : ''}`}>
            <input
              type="checkbox"
              id={`m-${m.id}`}
              checked={m.feita}
              onChange={(e) => void agir(() => api.marcarMicroetapa(m.id, e.target.checked))}
            />
            <label htmlFor={`m-${m.id}`}>{m.texto}</label>
          </div>
        ))
      ) : (
        <p className="muted small">
          Sem etapas ainda. Divida em passos pequenos para começar mais fácil.
        </p>
      )}
      <form
        className="flex mt-sm"
        style={{ gap: 8, alignItems: 'flex-end' }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!nova.trim()) return;
          void agir(async () => {
            await api.criarMicroetapa(t.id, nova.trim());
            setNova('');
          });
        }}
      >
        <Campo rotulo="Nova etapa">
          {({ id }) => (
            <input id={id} value={nova} maxLength={200} onChange={(e) => setNova(e.target.value)} />
          )}
        </Campo>
        <button type="submit" className="btn btn-outline btn-sm">
          Adicionar
        </button>
      </form>
      <hr className="divider" />
      <Planejar tarefa={t} aoPlanejar={aoMudar} />
      <hr className="divider" />
      <div className="chip-row">
        {t.situacao === 'concluida' ? (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => void agir(() => api.atualizarTarefa(t.id, { situacao: 'pendente' }))}
          >
            Reabrir atividade
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-teal btn-sm"
            onClick={() => void agir(() => api.atualizarTarefa(t.id, { situacao: 'concluida' }))}
          >
            <Icone nome="check" /> Marcar como concluída
          </button>
        )}
        {confirmar ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void agir(() => api.removerTarefa(t.id))}
            >
              Sim, remover
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setConfirmar(false)}
            >
              Cancelar
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmar(true)}>
            Remover atividade
          </button>
        )}
      </div>
    </div>
  );
}

export function Atividades() {
  const { dados, erro, recarregar } = useCarregar(api.tarefas);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [aberta, setAberta] = useState<string | null>(null);
  const [formulario, setFormulario] = useState(false);
  const hoje = paraTexto(new Date());
  const todas = dados?.tarefas ?? [];
  const lista = todas.filter((t) => {
    const concluida = t.situacao === 'concluida';
    if (filtro === 'atrasadas') return !concluida && t.prazo !== null && t.prazo < hoje;
    if (filtro === 'andamento')
      return !concluida && (percentual(t) > 0 || t.situacao === 'em_andamento');
    if (filtro === 'comecar') return !concluida && percentual(t) === 0 && t.situacao === 'pendente';
    if (filtro === 'concluidas') return concluida;
    return true;
  });

  return (
    <>
      <Titulo
        olho="Organização por etapas"
        titulo="Minhas atividades"
        sub="Você pode concluir uma etapa de cada vez, sem perder a visão do prazo."
        acoes={
          <button
            type="button"
            className="btn btn-primary"
            aria-expanded={formulario}
            onClick={() => setFormulario(!formulario)}
          >
            <Icone nome="plus" /> Adicionar atividade
          </button>
        }
      />
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {formulario ? (
        <div className="mb">
          <NovaAtividade
            aoCriar={() => {
              setFormulario(false);
              void recarregar();
            }}
          />
        </div>
      ) : null}
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Trabalhos e entregas</h2>
            <small>{todas.length} atividades</small>
          </div>
        </div>
        <fieldset className="chip-row mb" style={{ border: 0, padding: 0 }}>
          <legend className="sr-only">Filtrar atividades</legend>
          {FILTROS.map(([id, nome]) => (
            <button
              key={id}
              type="button"
              className={`btn btn-sm ${filtro === id ? 'btn-primary' : 'btn-outline'}`}
              aria-pressed={filtro === id}
              onClick={() => setFiltro(id)}
            >
              {nome}
            </button>
          ))}
        </fieldset>
        {!dados ? (
          <p role="status">Carregando…</p>
        ) : lista.length === 0 ? (
          <Vazio>Nenhuma atividade nesta seleção.</Vazio>
        ) : null}
        {lista.map((t) => {
          const s = situacaoDe(t, hoje);
          const aberto = aberta === t.id;
          return (
            <div key={t.id}>
              <div className="task-row">
                <div className={`task-icon t-${s.tom}`}>
                  <Icone nome="tasks" />
                </div>
                <div className="task-data">
                  <div className="flex" style={{ flexWrap: 'wrap', gap: 7 }}>
                    <strong style={{ fontSize: '.85rem' }}>{t.titulo}</strong>
                    <Pill tom={s.tom}>{s.texto}</Pill>
                  </div>
                  <div className="task-meta">
                    {[
                      t.disciplina,
                      t.prazo ? `${formatar(t.prazo)} · ${relativo(t.prazo, hoje)}` : 'sem prazo',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  <Progresso percentual={percentual(t)} rotulo={`Progresso de ${t.titulo}`} />
                </div>
                <div className="task-actions">
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    aria-expanded={aberto}
                    onClick={() => setAberta(aberto ? null : t.id)}
                  >
                    {aberto ? 'Fechar' : 'Ver etapas e plano'}
                    <span className="sr-only"> de {t.titulo}</span>
                  </button>
                </div>
              </div>
              {aberto ? <Detalhe t={t} aoMudar={() => void recarregar()} /> : null}
            </div>
          );
        })}
      </div>
      <div className="grid cols-2 mt">
        <div className="notice info">
          <b>Planejamento regressivo</b>
          Abra uma atividade com prazo e monte o plano para distribuir blocos de estudo antes da
          entrega.
        </div>
        <div className="notice">
          <b>Conclusão em pequenas etapas</b>
          Marque cada passo quando estiver pronto. O progresso é seu, não uma competição.
        </div>
      </div>
    </>
  );
}
