import React from 'react';
import { Tarefa } from '../../types';
import { CheckCircle2, Clock, Calendar, User, Tag, AlertCircle, Trash2, Pencil } from 'lucide-react';

interface DemandDetailPaneProps {
  demand: Tarefa | null;
  onToggleStatus: (id: number) => void;
  onDelete: (id: number) => void;
  /** Abre o modal de edição preenchido com esta demanda. */
  onEdit?: (demand: Tarefa) => void;
}

export const DemandDetailPane: React.FC<DemandDetailPaneProps> = ({
  demand,
  onToggleStatus,
  onDelete,
  onEdit,
}) => {
  if (!demand) {
    return (
      <div className="siesal-card rounded-3xl p-8 h-full flex flex-col items-center justify-center text-center text-slate-400 min-h-[380px]">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3 text-cyan-400">
          <Clock className="w-6 h-6" />
        </div>
        <p className="font-semibold text-slate-200 text-sm">Nenhuma demanda selecionada</p>
        <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
          Selecione uma atividade da lista ao lado para ver todas as informações detalhadas.
        </p>
      </div>
    );
  }

  const isDone = demand.status === 'Concluido';
  const atrasada = !isDone && new Date(demand.data_entrega) < new Date();

  return (
    <div className="siesal-card rounded-2xl p-6 h-full flex flex-col justify-between overflow-y-auto">
      <div className="space-y-5">
        {/* Cabeçalho do Painel Detalhado */}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
              {demand.tipo || 'Atividade'}
            </span>
            {atrasada && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/25 animate-pulse">
                Atrasada
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-white mt-2 leading-snug">
            {demand.titulo}
          </h2>
        </div>

        {/* Informações Estruturadas Minimalistas */}
        <div className="space-y-2.5 text-xs">
          {/* Matéria */}
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
            <span className="text-slate-400 font-normal flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              Matéria:
            </span>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white shadow-sm"
              style={{
                backgroundColor: demand.marcador?.cor || '#3b82f6',
              }}
            >
              {demand.marcador?.nome || 'Geral'}
            </span>
          </div>

          {/* Professor */}
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
            <span className="text-slate-400 font-normal flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              Professor:
            </span>
            <span className="font-medium text-slate-200">
              {demand.professor || 'Não informado'}
            </span>
          </div>

          {/* Prioridade */}
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
            <span className="text-slate-400 font-normal flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-cyan-400" />
              Prioridade:
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase ${
                demand.prioridade === 'Urgente' || demand.prioridade === 'Alta'
                  ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                  : demand.prioridade === 'Proximo'
                  ? 'bg-sky-500/10 text-sky-300 border border-sky-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {demand.prioridade}
            </span>
          </div>

          {/* Prazo */}
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
            <span className="text-slate-400 font-normal flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              Prazo:
            </span>
            <span className="font-semibold text-cyan-300">
              {new Date(demand.data_entrega).toLocaleDateString('pt-BR')} às{' '}
              {new Date(demand.data_entrega).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {/* Dificuldade */}
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
            <span className="text-slate-400 font-normal flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Dificuldade:
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.08] text-slate-300 text-[11px] font-medium">
              {demand.dificuldade || 'Médio'}
            </span>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
            <span className="text-slate-400 font-normal flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
              Status:
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                isDone
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : atrasada
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                  : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300'
              }`}
            >
              {isDone ? 'Concluído' : atrasada ? 'Atrasada' : 'No prazo'}
            </span>
          </div>
        </div>

        {/* Descrição */}
        <div>
          <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Descrição:
          </h3>
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-300 leading-relaxed min-h-[80px]">
            {demand.descricao || 'Sem descrição informada para esta atividade.'}
          </div>
        </div>
      </div>

      {/* Ações de Edição, Conclusão e Exclusão */}
      <div className="pt-4 flex items-center gap-2.5">
        <button
          onClick={() => onToggleStatus(demand.id_tarefa)}
          className={`flex-1 font-medium py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-all shadow-md ${
            isDone
              ? 'bg-amber-600/80 hover:bg-amber-600 text-white'
              : 'siesal-button-primary text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{isDone ? 'Reabrir Atividade' : 'Marcar como Concluída'}</span>
        </button>

        {onEdit && (
          <button
            onClick={() => onEdit(demand)}
            className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-cyan-500/15 border border-white/[0.06] hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 transition-all"
            title="Editar Demanda"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={() => onDelete(demand.id_tarefa)}
          className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-rose-950/40 border border-white/[0.06] hover:border-rose-500/30 text-slate-400 hover:text-rose-300 transition-all"
          title="Excluir Demanda"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
