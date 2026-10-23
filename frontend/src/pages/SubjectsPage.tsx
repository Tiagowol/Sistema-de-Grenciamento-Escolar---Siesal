import React from 'react';
import { Marcador, Tarefa } from '../types';
import { BookOpen, Plus, Trash2, CheckCircle2, Clock } from 'lucide-react';

interface SubjectsPageProps {
  subjects: Marcador[];
  demands: Tarefa[];
  onOpenAddSubject: () => void;
  onDeleteSubject: (id: number) => Promise<void>;
  onSelectSubjectFilter: (id: number) => void;
}

export const SubjectsPage: React.FC<SubjectsPageProps> = ({
  subjects,
  demands,
  onOpenAddSubject,
  onDeleteSubject,
  onSelectSubjectFilter,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="siesal-card rounded-2xl p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            Matérias e Disciplinas
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Organize suas atividades escolares separando-as por cores e disciplinas.
          </p>
        </div>

        <button
          onClick={onOpenAddSubject}
          data-tutorial="btn-nova-materia"
          className="siesal-button-primary text-white font-medium py-2 px-4 rounded-xl flex items-center gap-2 text-xs shadow-md"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nova Matéria</span>
        </button>
      </div>

      {/* Grid de Cards de Matérias */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-tutorial="lista-materias">
        {subjects.map((subject) => {
          const subjectDemands = demands.filter((d) => d.id_marcador === subject.id_marcador);
          const pendingCount = subjectDemands.filter((d) => d.status !== 'Concluido').length;
          const completedCount = subjectDemands.filter((d) => d.status === 'Concluido').length;
          const progressPct = subjectDemands.length > 0
            ? Math.round((completedCount / subjectDemands.length) * 100)
            : 0;

          return (
            <div
              key={subject.id_marcador}
              className="siesal-card rounded-2xl p-5 flex flex-col justify-between border-t-2 transition-all duration-250 group relative overflow-hidden"
              style={{ borderTopColor: subject.cor }}
            >
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-sm"
                      style={{ backgroundColor: subject.cor }}
                    />
                    <h3 className="text-base font-bold text-white tracking-wide">{subject.nome}</h3>
                  </div>

                  <button
                    onClick={() => onDeleteSubject(subject.id_marcador)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all"
                    title="Excluir Matéria"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Estatísticas da Matéria */}
                <div className="grid grid-cols-2 gap-2.5 my-3">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-sky-400" />
                      Pendentes
                    </span>
                    <span className="text-base font-bold text-sky-400 mt-0.5 block">{pendingCount}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Concluídas
                    </span>
                    <span className="text-base font-bold text-emerald-400 mt-0.5 block">{completedCount}</span>
                  </div>
                </div>

                {/* Barra de Progresso da Matéria */}
                <div className="my-3">
                  <div className="flex items-center justify-between text-[10px] font-semibold mb-1">
                    <span className="text-slate-400 uppercase tracking-wider">Progresso</span>
                    <span className="text-emerald-300">{progressPct}% concluído</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.04] border border-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700 ease-out"
                      style={{ width: `${Math.max(progressPct, 2)}%` }}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectSubjectFilter(subject.id_marcador)}
                className="w-full mt-2 py-2 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500 text-cyan-300 hover:text-white border border-cyan-500/20 text-xs font-semibold transition-all text-center"
              >
                Ver Demandas ({subjectDemands.length})
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
