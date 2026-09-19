import React from 'react';
import { X, Bell, Check, CheckCheck, Clock } from 'lucide-react';
import { Notificacao } from '../../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notificacao[];
  onMarkAsRead: (id: number) => void;
  onMarkAllAsRead: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-fade-in flex justify-end">
      <div className="w-full max-w-md bg-[#0a1432] border-l border-[#1b3472] h-full flex flex-col justify-between shadow-2xl p-6">
        <div>
          {/* Cabeçalho */}
          <div className="flex items-center justify-between pb-4 border-b border-[#1b3472] mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                <Bell className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white">Notificações e Avisos</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#13275c] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Ação de marcar todas como lidas */}
          {notifications.length > 0 && (
            <div className="flex justify-end mb-4">
              <button
                onClick={onMarkAllAsRead}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar todas como lidas
              </button>
            </div>
          )}

          {/* Lista de Notificações */}
          <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                <p className="text-sm">Nenhuma notificação por enquanto.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id_notificacao}
                  className={`p-4 rounded-2xl border transition-all ${
                    n.lida
                      ? 'bg-[#0e1c40]/60 border-[#19326d]/60 opacity-60'
                      : 'bg-[#112454] border-cyan-500/50 shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {n.titulo}
                        {!n.lida && (
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                        )}
                      </h4>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{n.mensagem}</p>
                      <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {new Date(n.data_envio).toLocaleString('pt-BR')}
                      </p>
                    </div>

                    {!n.lida && (
                      <button
                        onClick={() => onMarkAsRead(n.id_notificacao)}
                        className="p-1.5 rounded-lg bg-[#18367a] hover:bg-cyan-600 text-white transition-colors"
                        title="Marcar como lida"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="pt-4 border-t border-[#1b3472] text-center">
          <p className="text-xs text-slate-500">SIESAL • Notificações em tempo real</p>
        </div>
      </div>
    </div>
  );
};
