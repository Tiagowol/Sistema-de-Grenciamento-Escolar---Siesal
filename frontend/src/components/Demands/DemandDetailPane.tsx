import React from 'react';
import { Tarefa } from '../../types';
import { CheckCircle2, Clock, Calendar, User, Tag, AlertCircle, Trash2 } from 'lucide-react';

interface DemandDetailPaneProps {
  demand: Tarefa | null;
  onToggleStatus: (id: number) => void;
  onDelete: (id: number) => void;
}

export const DemandDetailPane: React.FC<DemandDetailPaneProps> = ({
  demand,
  onToggleStatus,
  onDelete,
}) => {
  if (!demand) {
    return (
      <div className="siesal-card rounded-3xl p-6 h-full flex flex-col items-center justify-center text-center text-slate-400">
        <Clock className="w-12 h-12 text-cyan-400/40 mb-3" />
        <p className="font-semibold text-slate-300">Nenhuma demanda selecionada</p>
        <p className="text-xs text-slate-500 mt-1">
          Clique em uma atividade da lista para ver todos os detalhes aqui.
        </p>
      </div>
    );
  }

  const isDone = demand.status === 'Concluido';

  return (
    <div className="siesal-card rounded-3xl p-6 h-full flex flex-col justify-between overflow-y-auto">
      <div className="space-y-5">
        {/* Cabeçalho do Painel Detalhado (Fiel ao Protótipo 5.3) */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
            {demand.tipo || 'Atividade'}:
          </span>
          <h2 className="text-2xl font-black text-white mt-1 leading-tight">
            {demand.titulo}
          </h2>
        </div>

        {/* Informações Estruturadas */}
        <div className="space-y-3.5 text-sm">
          {/* Matéria */}
          <div className="flex items-center justify-between pb-2 border-b border-[#1b3472]/60">
            <span className="text-slate-400 font-medium flex items-center gap-2">
              <Tag className="w-4 h-4 text-cyan-400" />
              Matéria:
            </span>
            <span
              className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm"
              style={{
                backgroundColor: demand.marcador?.cor || '#3b82f6',
              }}
            >
              {demand.marcador?.nome || 'Geral'}
            </span>
          </div>

          {/* Professor */}
          <div className="flex items-center justify-between pb-2 border-b border-[#1b3472]/60">
            <span className="text-slate-400 font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-cyan-400" />
              Professor:
            </span>
            <span className="font-bold text-slate-200">
              {demand.professor || 'Não informado'}
            </span>
          </div>

          {/* Prioridade */}
          <div className="flex items-center justify-between pb-2 border-b border-[#1b3472]/60">
            <span className="text-slate-400 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-cyan-400" />
              Prioridade:
            </span>
            <span
              className={`px-3 py-0.5 rounded-lg text-xs font-extrabold ${
                demand.prioridade === 'Urgente' || demand.prioridade === 'Alta'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                  : demand.prioridade === 'Proximo'
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              {demand.prioridade}
            </span>
          </div>

          {/* Prazo */}
          <div className="flex items-center justify-between pb-2 border-b border-[#1b3472]/60">
            <span className="text-slate-400 font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              Prazo:
            </span>
            <span className="font-bold text-cyan-300">
              {new Date(demand.data_entrega).toLocaleDateString('pt-BR')} |{' '}
              {new Date(demand.data_entrega).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {/* Dificuldade */}
          <div className="flex items-center justify-between pb-2 border-b border-[#1b3472]/60">
            <span className="text-slate-400 font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Dificuldade:
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-950/60 border border-blue-500/30 text-blue-300 text-xs font-semibold">
              {demand.dificuldade || 'Médio'}
            </span>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between pb-2 border-b border-[#1b3472]/60">
            <span className="text-slate-400 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              Status:
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                isDone
                  ? 'bg-emerald-950 border border-emerald-500 text-emerald-300'
                  : 'bg-cyan-950 border border-cyan-500 text-cyan-300'
              }`}
            >
              {isDone ? 'Concluído' : 'No prazo'}
            </span>
          </div>
        </div>

        {/* Descrição */}
        <div>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            Descrição:
          </h3>
          <div className="p-4 rounded-2xl bg-[#0a1430] border border-[#1e3b79] text-xs text-slate-300 leading-relaxed min-h-[90px]">
            {demand.descricao || 'Sem descrição informada para esta atividade.'}
          </div>
        </div>
      </div>

      {/* Ações de Conclusão e Exclusão */}
      <div className="pt-6 flex items-center gap-3">
        <button
          onClick={() => onToggleStatus(demand.id_tarefa)}
          className={`flex-1 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition-all shadow-md ${
            isDone
              ? 'bg-amber-600/80 hover:bg-amber-600 text-white'
              : 'siesal-button-primary text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{isDone ? 'Reabrir Atividade' : 'Marcar como Concluída'}</span>
        </button>

        <button
          onClick={() => onDelete(demand.id_tarefa)}
          className="p-3 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-600/40 text-rose-300 transition-all hover:scale-105"
          title="Excluir Demanda"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
