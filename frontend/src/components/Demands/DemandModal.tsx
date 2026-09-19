import React, { useState, useEffect } from 'react';
import { X, Calendar, User, Tag, AlertTriangle, HelpCircle, FileText, Sparkles, Zap } from 'lucide-react';
import { Marcador, PrioridadeType, DificuldadeType, TipoDemandaType } from '../../types';
import { calculateDynamicPriority } from '../../utils/priorityCalculator';

interface DemandModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Marcador[];
  onSubmit: (data: any) => Promise<void>;
}

export const DemandModal: React.FC<DemandModalProps> = ({
  isOpen,
  onClose,
  subjects,
  onSubmit,
}) => {
  const [titulo, setTitulo] = useState('');
  const [idMarcador, setIdMarcador] = useState<string>('');
  const [tipo, setTipo] = useState<TipoDemandaType>('Atividade');
  const [prioridade, setPrioridade] = useState<PrioridadeType>('Proximo');
  const [dificuldade, setDificuldade] = useState<DificuldadeType>('Médio');
  const [prazo, setPrazo] = useState('');
  const [professor, setProfessor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [criarLembrete, setCriarLembrete] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Recalcula dinamicamente a prioridade quando o prazo ou a dificuldade mudam
  useEffect(() => {
    if (prazo) {
      const calculated = calculateDynamicPriority(prazo, dificuldade);
      setPrioridade(calculated);
    }
  }, [prazo, dificuldade]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !prazo) return;

    setSubmitting(true);
    try {
      const calculated = calculateDynamicPriority(prazo, dificuldade);
      await onSubmit({
        titulo,
        id_marcador: idMarcador ? Number(idMarcador) : null,
        tipo,
        prioridade: calculated,
        dificuldade,
        data_entrega: prazo,
        professor,
        descricao,
        criar_lembrete: criarLembrete,
      });
      // Reset
      setTitulo('');
      setDescricao('');
      setProfessor('');
      setPrazo('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl siesal-card rounded-3xl p-6 sm:p-8 border border-cyan-500/40 relative shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1b3472] mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-500/50 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Adicionar Demanda</h2>
              <p className="text-xs text-slate-400">Prioridade é calculada dinamicamente pelo prazo e dificuldade.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#152a5e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              Título da Demanda *
            </label>
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Sujeito e Predicado, Lista de Exercícios..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Matéria */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-cyan-400" />
                Matéria *
              </label>
              <select
                value={idMarcador}
                onChange={(e) => setIdMarcador(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white focus:outline-none focus:border-cyan-400 transition-colors"
              >
                <option value="">Selecionar Matéria</option>
                {subjects.map((s) => (
                  <option key={s.id_marcador} value={s.id_marcador}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de Demanda */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                Tipo de Demanda *
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoDemandaType)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white focus:outline-none focus:border-cyan-400 transition-colors"
              >
                <option value="Atividade">Atividade</option>
                <option value="Trabalho">Trabalho</option>
                <option value="Prova">Prova</option>
                <option value="Exercício">Exercício</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Prazo de Entrega */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                Prazo de Entrega *
              </label>
              <input
                type="datetime-local"
                required
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>

            {/* Dificuldade */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Nível de Dificuldade *
              </label>
              <select
                value={dificuldade}
                onChange={(e) => setDificuldade(e.target.value as DificuldadeType)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white focus:outline-none focus:border-cyan-400 transition-colors"
              >
                <option value="Fácil">Fácil (Impacto menor no prazo)</option>
                <option value="Médio">Médio (Impacto moderado)</option>
                <option value="Difícil">Difícil (Eleva a urgência)</option>
              </select>
            </div>
          </div>

          {/* Prioridade Dinâmica Calculada */}
          <div className="p-3.5 rounded-2xl bg-[#0b1739] border border-[#1f3c7e] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="text-xs font-bold text-white">Prioridade Calculada Automaticamente:</span>
                <p className="text-[11px] text-slate-400">Determinada pelo cruzamento entre o prazo e a complexidade.</p>
              </div>
            </div>

            <span
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black shadow-md ${
                prioridade === 'Urgente'
                  ? 'bg-orange-500 text-white shadow-orange-500/30 animate-pulse'
                  : prioridade === 'Proximo'
                  ? 'bg-sky-500 text-white shadow-sky-500/30'
                  : 'bg-emerald-500 text-white shadow-emerald-500/30'
              }`}
            >
              {prioridade}
            </span>
          </div>

          <div>
            {/* Professor */}
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              Professor(a)
            </label>
            <input
              type="text"
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              placeholder="Ex: Diego Cisne"
              className="w-full px-4 py-2.5 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                Descrição da Atividade
              </span>
              <span className="text-[11px] text-slate-500 font-normal">(Opcional)</span>
            </label>
            <textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes adicionais, páginas do livro ou instruções do professor..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors resize-none"
            />
          </div>

          {/* Opção de Lembrete */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#0c183a] border border-[#1b3472]">
            <input
              type="checkbox"
              id="lembrete-chk"
              checked={criarLembrete}
              onChange={(e) => setCriarLembrete(e.target.checked)}
              className="w-4 h-4 rounded text-cyan-500 bg-[#080f24] border-slate-600 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="lembrete-chk" className="text-xs text-slate-300 cursor-pointer">
              Ativar lembrete automático 24h antes do prazo
            </label>
          </div>

          {/* Botão de Submissão */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full siesal-button-primary text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Adicionar Demanda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
