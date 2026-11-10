import { useEffect, useState } from 'react';
import { api, ErroApi, type SessaoFoco } from '../api';
import { BLOCOS, type Bloco } from '../blocos';
import { Aviso } from '../componentes/Aviso';
import { Titulo } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import { tempoVisualLigado } from '../componentes/TempoVisual';
import { useCarregar } from '../componentes/useCarregar';
import { relogio } from '../datas';
import { Icone } from '../icones';
import { texto } from '../linguagem-curta';

// Modo foco: um bloco por vez. O tempo vem do servidor, então continua certo se a página recarregar.
// Sem som e sem pontuação. Com o tempo visual ligado (padrão), uma forma diminui e os números ficam ocultos.
export function Foco({ tarefaInicial = '' }: { tarefaInicial?: string } = {}) {
  const tarefas = useCarregar(api.tarefas);
  const atual = useCarregar(api.sessaoAtual);
  const [bloco, setBloco] = useState<Bloco>(BLOCOS[0] as Bloco);
  const minutos = bloco.minutos;
  const [visual] = useState(tempoVisualLigado);
  const [tarefaId, setTarefaId] = useState(tarefaInicial);
  // Números: ocultos por padrão com o tempo visual ligado; o aluno liga e desliga
  const [numeros, setNumeros] = useState(() => {
    const guardado = localStorage.getItem('siesal-foco-numeros');
    return guardado === null ? !visual : guardado === '1';
  });
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
  // Parte que ainda falta (de 1 a 0): é o tamanho da forma
  const fracao = sessao ? restante / total : 1;
  const frase = !sessao
    ? `Bloco ${bloco.nome.toLowerCase()}`
    : acabou
      ? 'O bloco terminou'
      : fracao > 0.5
        ? 'Falta mais da metade'
        : fracao > 0.15
          ? 'Falta menos da metade'
          : 'Falta pouco';
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
      <Titulo olho={texto('focoOlho')} titulo="Modo foco" sub={texto('focoSub')} />
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      <div className="grid cols-2">
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="eyebrow">UM BLOCO DE CADA VEZ</div>
          <div className="focusbubble">
            <small>Seu tempo de foco</small>
            {visual ? (
              <span className="focusdisc" style={{ transform: `scale(${fracao})` }} />
            ) : null}
            <div
              className={`focusclock${numeros || !visual ? '' : ' focusword'}`}
              role="timer"
              aria-live="off"
              aria-label={
                numeros ? `Restam ${relogio(restante)}` : visual ? frase : 'Relógio oculto'
              }
            >
              {numeros ? relogio(sessao ? restante : minutos * 60) : visual ? frase : '••:••'}
            </div>
            <small aria-live="polite">
              {acabou
                ? 'O bloco terminou. Você pode concluir.'
                : sessao
                  ? 'Foco em andamento'
                  : 'Você pode começar quando quiser'}
            </small>
          </div>
          {visual ? null : (
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
          )}
          {!sessao ? (
            <fieldset className="blocos centro">
              <legend className="sr-only">Tamanho do bloco</legend>
              {BLOCOS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={bloco.id === b.id}
                  className={`btn btn-sm btn-bloco ${bloco.id === b.id ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setBloco(b)}
                >
                  {b.nome}
                  <small>{b.minutos} min</small>
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
              aria-pressed={numeros}
              onClick={() => {
                localStorage.setItem('siesal-foco-numeros', numeros ? '0' : '1');
                setNumeros(!numeros);
              }}
            >
              {numeros ? 'Ocultar os números' : 'Mostrar os números'}
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
            Escolha o bloco curto. Começar de forma possível é melhor que esperar o momento
            perfeito.
          </div>
        </div>
      </div>
    </>
  );
}
