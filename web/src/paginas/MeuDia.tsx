import { api, type ResumoTarefa } from '../api';
import { BLOCOS } from '../blocos';
import { Aviso } from '../componentes/Aviso';
import { Kpi, Pill, Progresso, Titulo, Vazio } from '../componentes/Basicos';
import { EscolhaAgora } from '../componentes/EscolhaAgora';
import { PrimeirosPassos } from '../componentes/PrimeirosPassos';
import type { Pagina } from '../componentes/Shell';
import { TempoVisual } from '../componentes/TempoVisual';
import { useCarregar } from '../componentes/useCarregar';
import { dataLonga, formatar } from '../datas';
import { Icone } from '../icones';
import { texto } from '../linguagem-curta';
import { moduloLigado } from '../modulos';
import { carregarPreferencias } from '../preferencias';

function Linha({ t, hoje, aoIr }: { t: ResumoTarefa; hoje: string; aoIr: (p: Pagina) => void }) {
  const pct = t.etapas ? Math.round((t.etapas_feitas / t.etapas) * 100) : 0;
  const atrasada = t.prazo !== null && t.prazo < hoje;
  return (
    <div className="task-row">
      <div className="task-icon t-blue">
        <Icone nome="tasks" />
      </div>
      <div className="task-data">
        <div className="flex" style={{ flexWrap: 'wrap', gap: 7 }}>
          <strong style={{ fontSize: '.85rem' }}>{t.titulo}</strong>
          {atrasada ? (
            <Pill tom="blue">Prazo passou</Pill>
          ) : t.prazo === hoje ? (
            <Pill tom="amber">Prazo hoje</Pill>
          ) : (
            <Pill tom="blue">Planejável</Pill>
          )}
        </div>
        <div className="task-meta">
          {t.disciplina ? `${t.disciplina} · ` : ''}
          <TempoVisual prazo={t.prazo} hoje={hoje} />
        </div>
        <Progresso percentual={pct} rotulo={`Progresso de ${t.titulo}`} />
      </div>
      <div className="task-actions">
        <button type="button" className="btn btn-soft btn-sm" onClick={() => aoIr('atividades')}>
          Ver etapas
        </button>
      </div>
    </div>
  );
}

// Painel "Meu dia": o que precisa de atenção, sem pressão
export function MeuDia({
  nome,
  aoIr,
  aoComecar,
}: {
  nome: string;
  aoIr: (p: Pagina) => void;
  aoComecar?: (tarefaId: string) => void;
}) {
  const { dados: d, erro } = useCarregar(api.meuDia);
  // L20: some também quando o Master desliga o módulo de apoio ao aluno
  const comEscolha = carregarPreferencias().escolhaAgora && moduloLigado('apoio_aluno');
  if (erro) return <Aviso tipo="warn">{erro}</Aviso>;
  if (!d) return <p role="status">Carregando…</p>;
  const atencao = [...d.atrasadas, ...d.para_hoje, ...d.proximas].slice(0, 4);
  const proxima = atencao[0];
  const pctGeral = d.tarefas_total ? Math.round((d.tarefas_concluidas / d.tarefas_total) * 100) : 0;
  return (
    <>
      <Titulo
        olho={texto('meuDiaOlho')}
        titulo={texto('meuDiaTitulo', { nome: nome.split(' ')[0] ?? '' })}
        sub={texto('meuDiaSub', { data: dataLonga(d.hoje) })}
        acoes={
          <button type="button" className="btn btn-primary" onClick={() => aoIr('atividades')}>
            <Icone nome="plus" /> Nova atividade
          </button>
        }
      />
      <PrimeirosPassos perfil="aluno" aoIr={aoIr} />
      {/* Modo simples (L20a): os 4 números e a rotina saem; ficam o próximo passo e as atividades */}
      <div className="grid cols-4 hide-on-simple">
        <Kpi
          numero={d.atrasadas.length}
          rotulo="Prazo passou"
          nota="Podemos reorganizar juntos"
          icone="clock"
          tom="blue"
        />
        <Kpi
          numero={d.para_hoje.length}
          rotulo="Para hoje"
          nota="Um passo de cada vez"
          icone="tasks"
          tom="blue"
        />
        <Kpi
          numero={d.proximas.length}
          rotulo="Próximos 7 dias"
          nota="Planeje antes do prazo"
          icone="calendar"
          tom="amber"
        />
        <Kpi
          numero={`${pctGeral}%`}
          rotulo="Atividades concluídas"
          nota="Seu progresso acumulado"
          icone="check"
          tom="teal"
        />
      </div>
      <div className="layout mt">
        <div className="stack">
          {comEscolha ? (
            <EscolhaAgora
              hoje={d.hoje}
              aoComecar={(id) => (aoComecar ? aoComecar(id) : aoIr('foco'))}
            />
          ) : null}
          <div className="card hero">
            <span className="hero-tag">
              <Icone nome="spark" /> {texto('meuDiaPassoTag')}
            </span>
            <h2>{proxima ? proxima.titulo : 'Nada pendente por agora'}</h2>
            <p>{proxima ? texto('meuDiaPassoTexto') : texto('meuDiaNadaTexto')}</p>
            <div className="btns">
              <button type="button" className="btn btn-light" onClick={() => aoIr('foco')}>
                <Icone nome="play" /> Começar um bloco curto
              </button>
              <button type="button" className="btn btn-outline" onClick={() => aoIr('atividades')}>
                <Icone nome="calendar" /> Montar meu plano
              </button>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <div>
                <h2>Atividades que precisam de atenção</h2>
                <small>{texto('meuDiaAtencaoSub')}</small>
              </div>
              <button type="button" className="small-link" onClick={() => aoIr('atividades')}>
                Ver todas <Icone nome="arrow" />
              </button>
            </div>
            {atencao.length ? (
              atencao.map((t) => <Linha key={t.id} t={t} hoje={d.hoje} aoIr={aoIr} />)
            ) : (
              <Vazio>
                Nenhuma atividade pendente. Um espaço livre também faz parte de um plano.
              </Vazio>
            )}
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h2>Hoje na agenda</h2>
                <small>{formatar(d.hoje, { day: 'numeric', month: 'long' })}</small>
              </div>
              <Icone nome="calendar" />
            </div>
            {d.eventos.length ? (
              d.eventos.map((e) => (
                <div key={e.id} className={`event ${e.tipo === 'estudo' ? 'event-study' : ''}`}>
                  <div className="event-time">{e.hora_inicio ?? '—'}</div>
                  <div className="event-marker" />
                  <div className="event-body">
                    <div className="event-title">{e.titulo}</div>
                    <div className="event-sub">
                      {e.minutos ? `${e.minutos} min` : 'Sem duração definida'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <Vazio>Sem compromissos hoje.</Vazio>
            )}
          </div>
          <div className="card hide-on-simple">
            <div className="card-head">
              <div>
                <h2>Rotina possível</h2>
                <small>Um plano flexível para o dia.</small>
              </div>
            </div>
            <div className="study-meter">
              <div className="meter-top">
                <span>Tempo de estudo hoje</span>
                <span>{d.minutos_estudados_hoje} min</span>
              </div>
              <Progresso
                percentual={Math.min(100, Math.round((d.minutos_estudados_hoje / 50) * 100))}
                rotulo="Estudo de hoje"
              />
              <p className="small muted mt-sm">
                Um bloco de {BLOCOS[0]?.minutos ?? 10} minutos já é um começo válido.
              </p>
            </div>
            <div className="chip-row mt-sm">
              <button type="button" className="btn btn-soft btn-sm" onClick={() => aoIr('foco')}>
                {d.sessao_atual ? 'Voltar ao modo foco' : 'Modo foco'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
