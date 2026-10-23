import React, { useState, useEffect } from 'react';
import { X, BookOpen, Palette, Trash2, Plus, Pencil } from 'lucide-react';
import { Marcador } from '../../types';
import { useDialog } from '../UI/SiesalDialog';

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Marcador[];
  onCreateSubject: (data: { nome: string; cor: string }) => Promise<void>;
  /** Edita nome/cor de uma matéria existente. */
  onUpdateSubject: (id: number, data: { nome?: string; cor?: string }) => Promise<void>;
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
  onUpdateSubject,
  onDeleteSubject,
}) => {
  const dialog = useDialog();
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset ao abrir (sempre inicia no modo criação)
  useEffect(() => {
    if (isOpen) {
      setEditingId(null);
      setNome('');
      setCor(PRESET_COLORS[0]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startEdit = (subj: Marcador) => {
    setEditingId(subj.id_marcador);
    setNome(subj.nome);
    setCor(subj.cor);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNome('');
    setCor(PRESET_COLORS[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;

    setSubmitting(true);
    try {
      if (editingId) {
        await onUpdateSubject(editingId, { nome, cor });
      } else {
        await onCreateSubject({ nome, cor });
      }
      setNome('');
      setCor(PRESET_COLORS[0]);
      setEditingId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (subj: Marcador) => {
    const ok = await dialog.confirm({
      title: 'Excluir matéria',
      message: (
        <>
          Excluir a matéria <strong className="text-slate-100">"{subj.nome}"</strong>? As demandas
          vinculadas não são apagadas — ficam apenas sem matéria.
        </>
      ),
      confirmLabel: 'Excluir',
      danger: true,
      icon: 'warning',
    });
    if (!ok) return;
    await onDeleteSubject(subj.id_marcador);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg siesal-card rounded-3xl p-6 sm:p-8 border border-cyan-500/40 relative shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-[#1b3472] mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-500/50 text-cyan-400">
              {editingId ? <Pencil className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">
                {editingId ? 'Editar Matéria' : 'Gerenciar Matérias'}
              </h2>
              <p className="text-xs text-slate-400">
                {editingId ? 'Altere o nome e a cor — aplicado em toda a interface.' : 'Cadastre, edite e organize as matérias escolares.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#152a5e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário de Criação/Edição */}
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

            {/* Paleta rápida */}
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${
                    cor.toLowerCase() === c.toLowerCase()
                      ? 'scale-125 ring-2 ring-white shadow-lg'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Cor personalizada (qualquer cor via seletor nativo de cores) */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0c183a] border border-[#1b3472]">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(cor) ? cor : '#06b6d4'}
                onChange={(e) => setCor(e.target.value)}
                className="w-10 h-9 rounded-lg cursor-pointer bg-transparent border border-white/10 p-0.5"
                title="Escolher cor personalizada"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-200">Cor personalizada</p>
                <p className="text-[10px] text-slate-500 font-mono truncate">
                  {cor} — use o seletor para qualquer tom
                </p>
              </div>
              <span
                className="ml-auto w-7 h-7 rounded-full border border-white/20 shrink-0 shadow-md"
                style={{ backgroundColor: cor }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 siesal-button-primary text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-md disabled:opacity-50"
            >
              {editingId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{editingId ? 'Salvar Alterações' : 'Adicionar Matéria'}</span>
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
              >
                Cancelar edição
              </button>
            )}
          </div>
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
                className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                  editingId === subj.id_marcador
                    ? 'bg-cyan-950/30 border-cyan-500/40'
                    : 'bg-[#0c183a] border-[#1b3472]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: subj.cor }}
                  />
                  <span className="text-sm font-bold text-white truncate">{subj.nome}</span>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">{subj.cor}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(subj)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-950/50 transition-colors"
                    title="Editar matéria"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(subj)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                    title="Excluir Matéria"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
