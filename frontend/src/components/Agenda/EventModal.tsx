import React, { useState } from 'react';
import { X, Calendar, MapPin, FileText, Sparkles } from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  defaultDate?: Date;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  defaultDate = new Date(),
}) => {
  const formattedDefaultDate = defaultDate.toISOString().split('T')[0];

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState(`${formattedDefaultDate}T08:00`);
  const [dataFim, setDataFim] = useState(`${formattedDefaultDate}T12:00`);
  const [local, setLocal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !dataInicio || !dataFim) return;

    setSubmitting(true);
    try {
      await onSubmit({
        titulo,
        descricao,
        data_inicio: dataInicio,
        data_fim: dataFim,
        local,
      });
      setTitulo('');
      setDescricao('');
      setLocal('');
      onClose();
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
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Adicionar Evento</h2>
              <p className="text-xs text-slate-400">Adicione compromissos, aulas ou eventos escolares.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#152a5e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              Título do Evento *
            </label>
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Início das aulas, Feira de Ciências..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                Data / Hora Início *
              </label>
              <input
                type="datetime-local"
                required
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                Data / Hora Término *
              </label>
              <input
                type="datetime-local"
                required
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              Local
            </label>
            <input
              type="text"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex: Sala 4B, Auditório Principal, Quadra..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              Descrição
            </label>
            <textarea
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Observações adicionais..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors resize-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full siesal-button-primary text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Criar Evento na Agenda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
