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
    <header className="h-20 bg-[#0a1330]/90 backdrop-blur-md border-b border-[#1b2f63] px-8 flex items-center justify-between sticky top-0 z-30 shadow-md">
      {/* Logotipo SIESAL */}
      <div className="flex items-center gap-3 cursor-pointer">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-extrabold text-xl tracking-wider">
          S
        </div>
        <div>
          <h1 className="text-2xl font-black text-white tracking-wider flex items-center gap-2">
            SIESAL
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-700 font-semibold uppercase tracking-widest">
              v1.0
            </span>
          </h1>
          <p className="text-xs text-slate-400 font-medium hidden sm:block">
            Sistema de Gerenciamento Escolar do Aluno
          </p>
        </div>
      </div>

      {/* Ações Rápidas */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenAddDemand}
          className="siesal-button-primary text-white font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar Demanda</span>
        </button>

        <button
          onClick={onOpenNotifications}
          className="relative p-2.5 rounded-xl bg-[#11234f] text-cyan-300 hover:bg-[#1a3575] hover:text-white transition-all border border-[#21438e]"
          title="Ver Notificações"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateSettings}
              className="p-2.5 rounded-xl bg-[#11234f] text-cyan-300 hover:bg-[#1a3575] hover:text-white transition-all border border-[#21438e] flex items-center gap-2 text-xs font-semibold"
              title="Meu Perfil"
            >
              <User className="w-4 h-4" />
              <span className="hidden md:inline truncate max-w-[100px]">{user?.nome}</span>
            </button>

            <button
              onClick={logout}
              className="p-2.5 rounded-xl bg-[#11234f] text-slate-300 hover:bg-rose-900/40 hover:text-rose-300 transition-all border border-[#21438e]"
              title="Sair da Conta"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onNavigateAuth}
            className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:brightness-110 transition-all border border-cyan-400 flex items-center gap-1.5 text-xs font-bold shadow-md shadow-cyan-500/20"
          >
            <LogIn className="w-4 h-4" />
            <span>Login / Inscrição</span>
          </button>
        )}
      </div>
    </header>
  );
};
