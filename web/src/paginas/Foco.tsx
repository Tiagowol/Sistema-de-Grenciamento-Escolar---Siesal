import { useEffect, useState } from 'react';
import { api, ErroApi, type SessaoFoco } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Titulo } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import { useCarregar } from '../componentes/useCarregar';
import { relogio } from '../datas';
import { Icone } from '../icones';

const DURACOES = [5, 10, 15, 25];

// Modo foco: um bloco por vez. O tempo vem do servidor, então continua certo se a página recarregar.
// Sem som e sem pontuação. O aluno pode ocultar os números e ver só a barra.
export function Foco() {
  const tarefas = useCarregar(api.tarefas);
  const atual = useCarregar(api.sessaoAtual);
  const [minutos, setMinutos] = useState(10);
  const [tarefaId, setTarefaId] = useState('');
  const [oculto, setOculto] = useState(() => localStorage.getItem('siesal-foco-oculto') === '1');
  const [erro, setErro] = useState('');
  const [passou, setPassou] = useState(0);
  const sessao: SessaoFoco | null = atual.dados?.sessao ?? null;

  // Conta os segundos desde a última resposta do servidor
  useEffect(() => {
    setPassou(0);
    if (!sessao) return;
    const t = setInterval(() => setPassou((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, [sessao]);

  const total = (sessao?.minutos_planejados ?? minutos) * 60;
  const decorrido = sessao ? sessao.segundos_decorridos + passou : 0;
  const restante = Math.max(0, total - decorrido);
  const acabou = Boolean(sessao) && restante === 0;
  const pct = sessao ? Math.min(100, Math.round((decorrido / total) * 100)) : 0;
  const abertas = (tarefas.dados?.tarefas ?? []).filter((t) => t.situacao !== 'concluida');
  const escolhida = abertas.find((t) => t.id === (sessao?.tarefa_id ?? tarefaId));
  const proximaEtapa = escolhida?.microetapas.find((m) => !m.feita)?.texto;

  const agir = async (f: () => Promise<unknown>) => {
    setErro('');
    try {
      await f();
      await atual.recarregar();
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível concluir.');
    }
  };

  return (
    <>
      <Titulo
        olho="Estudo sem excesso de estímulos"
        titulo="Modo foco"
        sub="Escolha uma atividade e um bloco curto. Pausas e recomeços fazem parte."
      />
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      <div className="grid cols-2">
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="eyebrow">UM BLOCO DE CADA VEZ</div>
          <div className="focusbubble">
            <small>Seu tempo de foco</small>
            <div
              className="focusclock"
              role="timer"
              aria-live="off"
              aria-label={oculto ? 'Relógio oculto' : `Restam ${relogio(restante)}`}
            >
              {oculto ? '••:••' : relogio(sessao ? restante : minutos * 60)}
            </div>
            <small aria-live="polite">
              {acabou
                ? 'O bloco terminou. Você pode concluir.'
                : sessao
                  ? 'Foco em andamento'
                  : 'Você pode começar quando quiser'}
            </small>
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-label="Progresso do bloco"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ margin: '14px auto', maxWidth: 360 }}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
          {!sessao ? (
            <fieldset
              className="chip-row"
              style={{ justifyContent: 'center', border: 0, padding: 0 }}
            >
              <legend className="sr-only">Duração do bloco</legend>
              {DURACOES.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={minutos === n}
                  className={`btn btn-sm ${minutos === n ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setMinutos(n)}
                >
                  {n} min
                </button>
              ))}
            </fieldset>
          ) : null}
          <div className="chip-row mt" style={{ justifyContent: 'center' }}>
            {sessao ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void agir(() => api.encerrarSessao(sessao.id, 'concluida'))}
                >
                  <Icone nome="check" /> Concluir bloco
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => void agir(() => api.encerrarSessao(sessao.id, 'interrompida'))}
                >
                  Parar por agora
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  void agir(() =>
                    api.iniciarSessao({ tarefa_id: tarefaId || null, minutos_planejados: minutos }),
                  )
                }
              >
                <Icone nome="play" /> Iniciar foco
              </button>
            )}
            <button
              type="button"
              className="btn btn-soft"
              aria-pressed={oculto}
              onClick={() => {
                localStorage.setItem('siesal-foco-oculto', oculto ? '0' : '1');
                setOculto(!oculto);
              }}
            >
              {oculto ? 'Mostrar o relógio' : 'Ocultar o relógio'}
            </button>
          </div>
          <p className="small muted mt">
            Sem som e sem pontuação. O cronômetro é apenas uma ferramenta de apoio.
          </p>
        </div>
        <div className="stack">
          <div className="card">
            <h2>Em que atividade você quer trabalhar?</h2>
            <div className="mt-sm">
              <Campo rotulo="Selecione uma atividade (opcional)">
                {({ id }) => (
                  <select
                    id={id}
                    value={sessao?.tarefa_id ?? tarefaId}
                    disabled={Boolean(sessao)}
                    onChange={(e) => setTarefaId(e.target.value)}
                  >
                    <option value="">Sem atividade específica</option>
                    {abertas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {[t.disciplina, t.titulo].filter(Boolean).join(' — ')}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
            </div>
            <hr className="divider" />
            <h3>Próxima etapa sugerida</h3>
            <p className="muted mt-sm">
              {proximaEtapa ??
                (escolhida
                  ? 'Você já concluiu as etapas desta atividade.'
                  : 'Escolha uma atividade para ver a próxima etapa.')}
            </p>
          </div>
          <div className="card">
            <h2>Preparação rápida</h2>
            {[
              'Tenho o material ou o link necessário.',
              'Sei qual pequeno passo vou fazer.',
              'Posso fazer uma pausa ao terminar.',
            ].map((t, i) => (
              <div className="step" key={t}>
                <input type="checkbox" id={`prep${i}`} />
                <label htmlFor={`prep${i}`}>{t}</label>
              </div>
            ))}
          </div>
          <div className="notice">
            <b>Precisa de menos tempo?</b>
            Escolha 5 minutos. Começar de forma possível é melhor que esperar o momento perfeito.
          </div>
        </div>
      </div>
    </>
  );
}
