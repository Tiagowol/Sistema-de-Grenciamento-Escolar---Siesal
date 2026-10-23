import React from 'react';
import { Tarefa, Marcador } from '../../types';
import { CheckCircle2, Circle, Clock, ChevronRight } from 'lucide-react';

interface DemandCardProps {
  demands: Tarefa[];
  subjects: Marcador[];
  selectedDemandId: number | null;
  onSelectDemand: (demand: Tarefa) => void;
  onToggleStatus: (id: number) => void;
}

export const DemandCard: React.FC<DemandCardProps> = ({
  demands,
  subjects,
  selectedDemandId,
  onSelectDemand,
  onToggleStatus,
}) => {
  // Agrupar demandas por Matéria (Fiel ao Protótipo 5.3)
  const groupedDemands = subjects.map((subject) => {
    const subjectDemands = demands.filter((d) => d.id_marcador === subject.id_marcador);
    return {
      subject,
      demands: subjectDemands,
    };
  }).filter(group => group.demands.length > 0);

  // Demandas sem matéria vinculada
  const unassignedDemands = demands.filter((d) => !d.id_marcador);

  if (demands.length === 0) {
    return (
      <div className="siesal-card rounded-3xl p-12 text-center text-slate-400">
        <Clock className="w-12 h-12 text-cyan-400 mx-auto mb-3 opacity-60" />
        <h3 className="text-lg font-bold text-white">Nenhuma demanda encontrada</h3>
        <p className="text-xs text-slate-400 mt-1">Tente ajustar seus filtros ou adicione uma nova atividade.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedDemands.map(({ subject, demands: subDemands }) => (
        <div key={subject.id_marcador} className="space-y-3">
          {/* Título do Grupo da Matéria */}
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shadow-sm"
              style={{ backgroundColor: subject.cor }}
            />
            <h3 className="text-base font-bold text-white tracking-wide">
              {subject.nome}:
            </h3>
            <span className="text-xs text-slate-400 font-semibold bg-[#11224d] px-2 py-0.5 rounded-full">
              {subDemands.length}
            </span>
          </div>

          {/* Cards da Matéria */}
          <div className="space-y-2">
              {subDemands.map((demand) => {
                const isSelected = selectedDemandId === demand.id_tarefa;
                const isDone = demand.status === 'Concluido';

                return (
                  <div
                    key={demand.id_tarefa}
                    onClick={() => onSelectDemand(demand)}
                    className={`p-3.5 rounded-2xl border transition-all duration-250 cursor-pointer flex items-center justify-between group relative overflow-hidden ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-400/60 shadow-lg shadow-cyan-500/10'
                        : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05] hover:border-cyan-500/30'
                    } ${isDone ? 'opacity-55' : 'opacity-100'}`}
                  >
                    {/* Barra lateral de seleção ativa */}
                    {isSelected && (
                      <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
                    )}

                    <div className="flex items-center gap-3 min-w-0">
                      {/* Botão de Conclusão Rápida */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStatus(demand.id_tarefa);
                        }}
                        className="text-slate-500 hover:text-cyan-400 transition-colors p-1 shrink-0"
                        title={isDone ? 'Marcar como pendente' : 'Marcar como concluído'}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 transition-transform active:scale-90" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition-all active:scale-90" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-cyan-400/90 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-cyan-500/10 shrink-0">
                            {demand.tipo || 'Atividade'}
                          </span>
                          <h4
                            className={`text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-white truncate transition-colors ${
                              isDone ? 'line-through text-slate-400' : ''
                            }`}
                          >
                            {demand.titulo}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 truncate">
                          <span>Prazo: {new Date(demand.data_entrega).toLocaleDateString('pt-BR')}</span>
                          {demand.professor && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-300 truncate">Prof. {demand.professor}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Indicadores Visuais da Direita */}
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {demand.status !== 'Concluido' && new Date(demand.data_entrega) < new Date() && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase bg-rose-500/10 text-rose-300 border-rose-500/25 animate-pulse">
                          Atrasada
                        </span>
                      )}
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase ${
                          demand.prioridade === 'Urgente'
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/25'
                            : demand.prioridade === 'Proximo'
                            ? 'bg-sky-500/10 text-sky-300 border-sky-500/25'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                        }`}
                      >
                        {demand.prioridade}
                      </span>

                      <div className="w-6 h-6 rounded-lg bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-slate-400 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

      {/* Demandas sem matéria */}
      {unassignedDemands.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-white tracking-wide">
            Outras Atividades:
          </h3>
          <div className="space-y-2.5">
            {unassignedDemands.map((demand) => (
              <div
                key={demand.id_tarefa}
                onClick={() => onSelectDemand(demand)}
                className="p-4 rounded-2xl bg-[#0f1d43]/80 border border-[#1d3876] flex items-center justify-between cursor-pointer hover:border-cyan-400"
              >
                <div>
                  <h4 className="text-sm font-bold text-white">{demand.titulo}</h4>
                  <p className="text-xs text-slate-400">{demand.tipo || 'Atividade'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
