import React, { useState } from 'react';
import { Tarefa, Marcador } from '../types';
import { DemandCard } from '../components/Demands/DemandCard';
import { DemandDetailPane } from '../components/Demands/DemandDetailPane';
import { Plus, Filter, Search } from 'lucide-react';

interface DemandsPageProps {
  demands: Tarefa[];
  subjects: Marcador[];
  /** Filtro de matéria controlado pelo App (vindo de Matérias → "Ver Demandas"). */
  subjectFilter: number | null;
  onSubjectFilterChange: (id: number | null) => void;
  onToggleStatus: (id: number) => void;
  onDeleteDemand: (id: number) => void;
  /** Abre o modal de edição da demanda. */
  onEditDemand: (demand: Tarefa) => void;
  onOpenAddDemand: () => void;
  onOpenAddSubject: () => void;
}

export const DemandsPage: React.FC<DemandsPageProps> = ({
  demands,
  subjects,
  subjectFilter,
  onSubjectFilterChange,
  onToggleStatus,
  onDeleteDemand,
  onEditDemand,
  onOpenAddDemand,
  onOpenAddSubject,
}) => {
  const [selectedDemandId, setSelectedDemandId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('todos');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('todos');
  const [filterType, setFilterType] = useState<string>('todos');

  // Sempre deriva a demanda selecionada da lista atual: evita exibir dados
  // desatualizados (status/prioridade antigos) após recarregar ou alternar status
  const selectedDemand = selectedDemandId !== null
    ? demands.find((d) => d.id_tarefa === selectedDemandId) || null
    : null;

  // Filtragem local
  const filteredDemands = demands.filter((d) => {
    if (subjectFilter !== null && d.id_marcador !== subjectFilter) {
      return false;
    }
    if (filterPriority !== 'todos' && d.prioridade !== filterPriority) {
      return false;
    }
    if (filterDifficulty !== 'todos' && d.dificuldade !== filterDifficulty) {
      return false;
    }
    if (filterType !== 'todos' && d.tipo !== filterType) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = d.titulo.toLowerCase().includes(q);
      const matchProf = d.professor?.toLowerCase().includes(q);
      const matchDesc = d.descricao?.toLowerCase().includes(q);
      return matchTitle || matchProf || matchDesc;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Barra de Filtros por Matéria */}
      <div className="siesal-card rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-white text-sm">Filtrar por Matéria</span>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar atividade, professor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white/[0.03] border border-white/[0.08] focus:border-cyan-400/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Chips de Matérias */}
        <div className="flex items-center gap-2 flex-wrap pt-1" data-tutorial="filtros-materia">
          <button
            onClick={() => onSubjectFilterChange(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              subjectFilter === null
                ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-sm shadow-cyan-500/30'
                : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            Todas as Matérias
          </button>

          {subjects.map((subj) => {
            const isSelected = subjectFilter === subj.id_marcador;
            return (
              <button
                key={subj.id_marcador}
                onClick={() => onSubjectFilterChange(isSelected ? null : subj.id_marcador)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'ring-2 ring-white/80 shadow-md text-white scale-[1.03]'
                    : 'opacity-80 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: subj.cor,
                  color: '#ffffff',
                }}
              >
                <span>{subj.nome}</span>
              </button>
            );
          })}

          <button
            onClick={onOpenAddSubject}
            className="px-3 py-1 rounded-full text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-cyan-300 hover:bg-cyan-500/20 hover:text-white transition-all flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>Nova Matéria</span>
          </button>
        </div>

        {/* Sub-filtros por Prioridade, Dificuldade e Tipo */}
        <div className="flex items-center gap-4 pt-2.5 border-t border-white/[0.06] flex-wrap text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Prioridade:</span>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-400/50"
            >
              <option value="todos" className="bg-[#091432]">Todas</option>
              <option value="Urgente" className="bg-[#091432]">Urgente</option>
              <option value="Proximo" className="bg-[#091432]">Próximo</option>
              <option value="Longe" className="bg-[#091432]">Longe</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Dificuldade:</span>
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-400/50"
            >
              <option value="todos" className="bg-[#091432]">Todas</option>
              <option value="Fácil" className="bg-[#091432]">Fácil</option>
              <option value="Médio" className="bg-[#091432]">Médio</option>
              <option value="Difícil" className="bg-[#091432]">Difícil</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Tipo:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-400/50"
            >
              <option value="todos" className="bg-[#091432]">Todos</option>
              <option value="Atividade" className="bg-[#091432]">Atividade</option>
              <option value="Trabalho" className="bg-[#091432]">Trabalho</option>
              <option value="Prova" className="bg-[#091432]">Prova</option>
              <option value="Exercício" className="bg-[#091432]">Exercício</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid Principal: Lista à Esquerda e Detalhes à Direita (Fiel ao Protótipo 5.3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Lista de Demandas por Matéria */}
        <div className="lg:col-span-7" data-tutorial="lista-demandas">
          <DemandCard
            demands={filteredDemands}
            subjects={subjects}
            selectedDemandId={selectedDemand?.id_tarefa || null}
            onSelectDemand={(demand) => setSelectedDemandId(demand.id_tarefa)}
            onToggleStatus={onToggleStatus}
          />
        </div>

        {/* Painel Detalhado Lateral */}
        <div className="lg:col-span-5 sticky top-24" data-tutorial="painel-detalhes">
          <DemandDetailPane
            demand={selectedDemand}
            onToggleStatus={onToggleStatus}
            onEdit={onEditDemand}
            onDelete={(id) => {
              onDeleteDemand(id);
              if (selectedDemandId === id) {
                setSelectedDemandId(null);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};
