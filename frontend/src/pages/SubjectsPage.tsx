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
      <div className="siesal-card rounded-3xl p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-cyan-400" />
            Matérias e Disciplinas Escolares
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Organize suas atividades escolares separando-as por cores e matérias.
          </p>
        </div>

        <button
          onClick={onOpenAddSubject}
          className="siesal-button-primary text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 text-xs shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Matéria</span>
        </button>
      </div>

      {/* Grid de Cards de Matérias */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map((subject) => {
          const subjectDemands = demands.filter((d) => d.id_marcador === subject.id_marcador);
          const pendingCount = subjectDemands.filter((d) => d.status !== 'Concluido').length;
          const completedCount = subjectDemands.filter((d) => d.status === 'Concluido').length;

          return (
            <div
              key={subject.id_marcador}
              className="siesal-card rounded-3xl p-6 flex flex-col justify-between border-t-4 transition-all group"
              style={{ borderTopColor: subject.cor }}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-4 h-4 rounded-full shadow-md"
                      style={{ backgroundColor: subject.cor }}
                    />
                    <h3 className="text-lg font-black text-white">{subject.nome}</h3>
                  </div>

                  <button
                    onClick={() => onDeleteSubject(subject.id_marcador)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all"
                    title="Excluir Matéria"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Estatísticas da Matéria */}
                <div className="grid grid-cols-2 gap-2 my-4">
                  <div className="p-3 rounded-xl bg-[#09132e] border border-[#1a336c]">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-sky-400" />
                      Pendentes
                    </span>
                    <span className="text-lg font-black text-sky-400">{pendingCount}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#09132e] border border-[#1a336c]">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Concluídas
                    </span>
                    <span className="text-lg font-black text-emerald-400">{completedCount}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectSubjectFilter(subject.id_marcador)}
                className="w-full mt-2 py-2 px-4 rounded-xl bg-[#112454] hover:bg-cyan-600 text-cyan-300 hover:text-white text-xs font-bold transition-all text-center"
              >
                Ver Todas as Demandas ({subjectDemands.length})
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
