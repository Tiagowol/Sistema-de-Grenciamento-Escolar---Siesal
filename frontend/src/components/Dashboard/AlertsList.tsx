import React from 'react';
import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { Notificacao } from '../../types';

interface AlertsListProps {
  alerts: Notificacao[];
  onMarkRead?: (id: number) => void;
}

export const AlertsList: React.FC<AlertsListProps> = ({ alerts, onMarkRead }) => {
  return (
    <div className="siesal-card rounded-3xl p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-400 animate-pulse" />
          Avisos
        </h2>
        <span className="text-xs px-2.5 py-1 rounded-full bg-rose-950/80 border border-rose-600/50 text-rose-300 font-bold">
          {alerts.filter((a) => !a.lida).length} pendentes
        </span>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto pr-1">
        {alerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2 opacity-80" />
            <p className="text-sm font-medium">Nenhum aviso urgente no momento!</p>
            <p className="text-xs text-slate-500 mt-1">Todas as atividades estão em dia.</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const isToday = alert.mensagem.toLowerCase().includes('hoje');
            const isPriority = alert.mensagem.toLowerCase().includes('prioritária');

            return (
              <div
                key={alert.id_notificacao}
                className={`p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden group cursor-pointer ${
                  isToday
                    ? 'bg-gradient-to-r from-rose-950/70 to-red-900/40 border-rose-500/60 shadow-lg shadow-rose-950/40'
                    : isPriority
                    ? 'bg-gradient-to-r from-amber-950/70 to-orange-900/40 border-amber-500/60 shadow-lg shadow-amber-950/40'
                    : 'bg-[#12234e]/80 border-[#22448a]'
                }`}
                onClick={() => onMarkRead && onMarkRead(alert.id_notificacao)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-xl mt-0.5 ${
                      isToday
                        ? 'bg-rose-600 text-white'
                        : isPriority
                        ? 'bg-amber-500 text-slate-900'
                        : 'bg-cyan-600 text-white'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-bold text-white leading-snug">
                      {alert.mensagem}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(alert.data_envio).toLocaleDateString('pt-BR')} • Notificação automática
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
