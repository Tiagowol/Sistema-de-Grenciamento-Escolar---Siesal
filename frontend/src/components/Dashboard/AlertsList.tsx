import React from 'react';
import { AlertCircle, Clock, CheckCircle2, Bell } from 'lucide-react';
import { Notificacao } from '../../types';

interface AlertsListProps {
  alerts: Notificacao[];
  onMarkRead?: (id: number) => void;
}

export const AlertsList: React.FC<AlertsListProps> = ({ alerts, onMarkRead }) => {
  const pendingCount = alerts.filter((a) => !a.lida).length;

  return (
    <div className="siesal-card rounded-2xl p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="text-xs font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-rose-400" />
          Avisos do Sistema
        </h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-300 font-bold uppercase tracking-wider">
          {pendingCount} {pendingCount === 1 ? 'pendente' : 'pendentes'}
        </span>
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto pr-1">
        {alerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-xs font-semibold text-slate-200">Tudo em dia!</p>
            <p className="text-[11px] text-slate-500 mt-0.5 max-w-[180px]">Nenhum aviso ou alerta pendente no momento.</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const isToday = alert.mensagem.toLowerCase().includes('hoje');
            const isPriority = alert.mensagem.toLowerCase().includes('prioritária');

            return (
              <div
                key={alert.id_notificacao}
                className={`p-3 rounded-xl border transition-all duration-200 relative overflow-hidden group cursor-pointer ${
                  isToday
                    ? 'bg-rose-950/25 border-rose-500/30 hover:border-rose-400/70 hover:bg-rose-950/40 shadow-sm'
                    : isPriority
                    ? 'bg-amber-950/25 border-amber-500/30 hover:border-amber-400/70 hover:bg-amber-950/40 shadow-sm'
                    : 'bg-white/[0.02] border-white/[0.05] hover:border-cyan-500/40 hover:bg-white/[0.05]'
                }`}
                onClick={() => onMarkRead && onMarkRead(alert.id_notificacao)}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`p-1.5 rounded-lg shrink-0 mt-0.5 transition-transform group-hover:scale-105 ${
                      isToday
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                        : isPriority
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                        : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-100 leading-snug group-hover:text-white transition-colors">
                      {alert.mensagem}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                      <span>{new Date(alert.data_envio).toLocaleDateString('pt-BR')}</span>
                      <span>•</span>
                      <span className="text-cyan-400/80 group-hover:underline">Concluir</span>
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
