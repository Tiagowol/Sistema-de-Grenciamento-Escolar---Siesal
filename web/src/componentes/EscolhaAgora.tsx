import { useState } from 'react';
import { api, type Tarefa } from '../api';
import { Icone } from '../icones';
import { texto } from '../linguagem-curta';
import { Aviso } from './Aviso';
import { Carregando, Vazio } from './Basicos';
import { PedirAjuda } from './PedirAjuda';
import { TempoVisual } from './TempoVisual';
import { useCarregar } from './useCarregar';

// Uma etapa por vez, das atividades abertas: prazo mais próximo primeiro; sem prazo por último
export function etapasParaEscolher(tarefas: Tarefa[]) {
  return tarefas
    .filter((t) => t.situacao !== 'concluida')
    .sort((a, b) => (a.prazo ?? '9999-12-31').localeCompare(b.prazo ?? '9999-12-31'))
    .map((t) => ({ tarefa: t, etapa: t.microetapas.find((m) => !m.feita) ?? null }));
}

// "Escolha o que fazer agora" (L17, item 2): mostra uma etapa por vez, com 3 escolhas.
// "Agora não" não grava nada: o cartão só some nesta visita. Sem contagem, sem pontos, sem cobrança.
export function EscolhaAgora({
  hoje,
  aoComecar,
}: {
  hoje: string;
  aoComecar: (id: string) => void;
}) {
  const { dados, erro } = useCarregar(api.tarefas);
  const [indice, setIndice] = useState(0);
  const [agoraNao, setAgoraNao] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  const opcoes = etapasParaEscolher(dados?.tarefas ?? []);
  const atual = opcoes.length ? opcoes[indice % opcoes.length] : undefined;

  return (
    <section className="card escolha-agora" aria-labelledby="escolha-agora-titulo">
      <div className="card-head">
        <div>
          <h2 id="escolha-agora-titulo">{texto('escolhaTitulo')}</h2>
          <small>{texto('escolhaSub')}</small>
        </div>
        <Icone nome="spark" />
      </div>
      {erro ? (
        <Aviso tipo="warn">{erro}</Aviso>
      ) : !dados ? (
        <Carregando />
      ) : agoraNao ? (
        <p role="status">{texto('escolhaAgoraNao')}</p>
      ) : !atual ? (
        <Vazio>{texto('escolhaVazio')}</Vazio>
      ) : (
        <>
          <p className="escolha-etapa">
            {atual.etapa ? (
              <>
                <span className="muted small">Etapa</span>
                <strong className="escolha-texto">{atual.etapa.texto}</strong>
              </>
            ) : (
              <>
                <span className="muted small">Atividade sem etapas</span>
                <strong className="escolha-texto">{atual.tarefa.titulo}</strong>
              </>
            )}
          </p>
          <p className="small">
            {atual.etapa ? `Atividade: ${atual.tarefa.titulo}` : null}
            {atual.etapa && atual.tarefa.disciplina ? ' · ' : null}
            {atual.tarefa.disciplina || null}
          </p>
          <div className="task-meta">
            Prazo: <TempoVisual prazo={atual.tarefa.prazo} hoje={hoje} />
          </div>
          {ajuda ? (
            <PedirAjuda
              tarefa={atual.tarefa}
              etapaInicial={atual.etapa?.id}
              aoFechar={() => setAjuda(false)}
            />
          ) : (
            <div className="chip-row mt-sm">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => aoComecar(atual.tarefa.id)}
              >
                <Icone nome="play" /> Começar
              </button>
              {opcoes.length > 1 ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setIndice((i) => i + 1)}
                >
                  Mostrar outra
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setAgoraNao(true)}
              >
                Agora não
              </button>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setAjuda(true)}>
                <Icone nome="help" /> Preciso de ajuda
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
