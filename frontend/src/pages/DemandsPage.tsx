import React, { useState } from 'react';
import { Tarefa, Marcador } from '../types';
import { DemandCard } from '../components/Demands/DemandCard';
import { DemandDetailPane } from '../components/Demands/DemandDetailPane';
import { Plus, Filter, Search } from 'lucide-react';

interface DemandsPageProps {
  demands: Tarefa[];
  subjects: Marcador[];
  onToggleStatus: (id: number) => void;
  onDeleteDemand: (id: number) => void;
  onOpenAddDemand: () => void;
  onOpenAddSubject: () => void;
}

export const DemandsPage: React.FC<DemandsPageProps> = ({
  demands,
  subjects,
  onToggleStatus,
  onDeleteDemand,
  onOpenAddDemand,
  onOpenAddSubject,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedDemand, setSelectedDemand] = useState<Tarefa | null>(demands[0] || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('todos');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('todos');
  const [filterType, setFilterType] = useState<string>('todos');

  // Filtragem local
  const filteredDemands = demands.filter((d) => {
    if (selectedSubjectId !== null && d.id_marcador !== selectedSubjectId) {
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
      {/* Barra de Filtros por Matéria (Fiel ao Protótipo 5.3) */}
      <div className="siesal-card rounded-3xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-cyan-400" />
            <span className="font-extrabold text-white text-base">Filtros :</span>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar demanda ou professor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#091432] border border-[#1d3b7d] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Chips de Matérias (Protótipo 5.3) */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedSubjectId(null)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              selectedSubjectId === null
                ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30'
                : 'bg-[#10224d] text-slate-300 hover:bg-[#162e66]'
            }`}
          >
            Todas as Matérias
          </button>

          {subjects.map((subj) => {
            const isSelected = selectedSubjectId === subj.id_marcador;
            return (
              <button
                key={subj.id_marcador}
                onClick={() => setSelectedSubjectId(isSelected ? null : subj.id_marcador)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'ring-2 ring-white shadow-lg'
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
            className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#142654] border border-[#23468e] text-cyan-300 hover:bg-cyan-600 hover:text-white transition-all flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Criar Matéria</span>
          </button>
        </div>

        {/* Sub-filtros por Prioridade, Dificuldade e Tipo */}
        <div className="flex items-center gap-3 pt-2 border-t border-[#1a336c] flex-wrap text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Prioridade:</span>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-[#091432] border border-[#1d3b7d] rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value="todos">Todas</option>
              <option value="Urgente">Urgente</option>
              <option value="Proximo">Próximo</option>
              <option value="Longe">Longe</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Dificuldade:</span>
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="bg-[#091432] border border-[#1d3b7d] rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value="todos">Todas</option>
              <option value="Fácil">Fácil</option>
              <option value="Médio">Médio</option>
              <option value="Difícil">Difícil</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Tipo:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-[#091432] border border-[#1d3b7d] rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value="todos">Todos</option>
              <option value="Atividade">Atividade</option>
              <option value="Trabalho">Trabalho</option>
              <option value="Prova">Prova</option>
              <option value="Exercício">Exercício</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid Principal: Lista à Esquerda e Detalhes à Direita (Fiel ao Protótipo 5.3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Lista de Demandas por Matéria */}
        <div className="lg:col-span-7">
          <DemandCard
            demands={filteredDemands}
            subjects={subjects}
            selectedDemandId={selectedDemand?.id_tarefa || null}
            onSelectDemand={(demand) => setSelectedDemand(demand)}
            onToggleStatus={onToggleStatus}
          />
        </div>

        {/* Painel Detalhado Lateral */}
        <div className="lg:col-span-5 sticky top-24">
          <DemandDetailPane
            demand={selectedDemand}
            onToggleStatus={onToggleStatus}
            onDelete={(id) => {
              onDeleteDemand(id);
              if (selectedDemand?.id_tarefa === id) {
                setSelectedDemand(null);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};
