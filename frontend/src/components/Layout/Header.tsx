import React from 'react';
import { Plus, Bell, LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onOpenAddDemand: () => void;
  onOpenNotifications: () => void;
  onNavigateAuth: () => void;
  onNavigateSettings: () => void;
  unreadCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddDemand,
  onOpenNotifications,
  onNavigateAuth,
  onNavigateSettings,
  unreadCount = 0,
}) => {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <header className="h-16 bg-[#040816]/75 backdrop-blur-xl border-b border-white/[0.06] px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm transition-all">
      {/* Logotipo SIESAL */}
      <div className="flex items-center gap-3 cursor-pointer group">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/25 text-white font-extrabold text-base tracking-wider group-hover:scale-105 group-hover:rotate-2 transition-all duration-300">
          S
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-wide">
              SIESAL
            </h1>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-400/10 text-cyan-300 border border-cyan-400/20 font-semibold uppercase tracking-wider">
              V2
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-normal hidden sm:block">
            Gerenciamento Escolar Inteligente
          </p>
        </div>
      </div>

      {/* Ações Rápidas Minimalistas */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenAddDemand}
          data-tutorial="btn-nova-demanda"
          className="siesal-button-primary text-white font-medium px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs shadow-md"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nova Demanda</span>
          <span className="sm:hidden">Nova</span>
        </button>

        <button
          onClick={onOpenNotifications}
          className="relative p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] text-slate-300 hover:text-cyan-300 transition-all border border-white/[0.06] hover:border-cyan-500/30"
          title="Ver Notificações"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateSettings}
              className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] text-slate-300 hover:text-cyan-300 transition-all border border-white/[0.06] hover:border-cyan-500/30 flex items-center gap-2 text-xs font-medium"
              title="Meu Perfil"
            >
              <div className="w-5 h-5 rounded-md bg-cyan-500/15 flex items-center justify-center text-cyan-400">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="hidden md:inline truncate max-w-[120px]">{user?.nome?.split(' ')[0]}</span>
            </button>

            <button
              onClick={logout}
              className="p-2 rounded-xl bg-white/[0.03] hover:bg-rose-950/30 text-slate-400 hover:text-rose-300 transition-all border border-white/[0.06] hover:border-rose-500/30"
              title="Sair da Conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onNavigateAuth}
            className="p-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:brightness-110 transition-all border border-cyan-400/40 flex items-center gap-1.5 text-xs font-semibold shadow-md shadow-cyan-500/20"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Login</span>
          </button>
        )}
      </div>
    </header>
  );
};
