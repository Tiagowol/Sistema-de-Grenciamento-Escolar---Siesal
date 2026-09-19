import React, { useState } from 'react';
import { X, BookOpen, Palette, Trash2, Plus } from 'lucide-react';
import { Marcador } from '../../types';

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Marcador[];
  onCreateSubject: (data: { nome: string; cor: string }) => Promise<void>;
  onDeleteSubject: (id: number) => Promise<void>;
}

const PRESET_COLORS = [
  '#F97316', // Laranja
  '#3B82F6', // Azul
  '#22C55E', // Verde
  '#EAB308', // Amarelo
  '#06B6D4', // Ciano
  '#A855F7', // Roxo
  '#EC4899', // Rosa
  '#EF4444', // Vermelho
  '#14B8A6', // Teal
  '#6366F1', // Indigo
];

export const SubjectModal: React.FC<SubjectModalProps> = ({
  isOpen,
  onClose,
  subjects,
  onCreateSubject,
  onDeleteSubject,
}) => {
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(PRESET_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;

    setSubmitting(true);
    try {
      await onCreateSubject({ nome, cor });
      setNome('');
      setCor(PRESET_COLORS[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg siesal-card rounded-3xl p-6 sm:p-8 border border-cyan-500/40 relative shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#1b3472] mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-500/50 text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Gerenciar Matérias</h2>
              <p className="text-xs text-slate-400">Cadastre e organize as matérias escolares.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#152a5e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário de Criação */}
        <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-[#0a1430] border border-[#1d3a77] mb-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nome da Matéria *
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Filosofia, Física, Química..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#0e1c44] border border-[#23458e] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-cyan-400" />
              Cor do Marcador
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${
                    cor === c ? 'scale-125 ring-2 ring-white shadow-lg' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full siesal-button-primary text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Matéria</span>
          </button>
        </form>

        {/* Lista de Matérias Existentes */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Matérias Cadastradas ({subjects.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {subjects.map((subj) => (
              <div
                key={subj.id_marcador}
                className="p-3 rounded-xl bg-[#0c183a] border border-[#1b3472] flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: subj.cor }}
                  />
                  <span className="text-sm font-bold text-white">{subj.nome}</span>
                </div>
                <button
                  onClick={() => onDeleteSubject(subj.id_marcador)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                  title="Excluir Matéria"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
