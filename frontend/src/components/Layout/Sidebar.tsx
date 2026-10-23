import React from 'react';
import { Home, ListTodo, Calendar, BookOpen, Bell, Settings, User, LogIn, Sparkles, ShieldAlert, HelpCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentTab: 'inicio' | 'demandas' | 'agenda' | 'materias' | 'configuracoes' | 'auth' | 'admin';
  setCurrentTab: (tab: 'inicio' | 'demandas' | 'agenda' | 'materias' | 'configuracoes' | 'auth' | 'admin') => void;
  onOpenNotifications: () => void;
  onOpenTutorial?: () => void;
  unreadNotificationsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenNotifications,
  onOpenTutorial,
  unreadNotificationsCount = 0,
}) => {
  const { user, isAuthenticated } = useAuth();

  const navItems = [
    { id: 'inicio', label: 'Início', icon: Home },
    { id: 'demandas', label: 'Todas as demandas', icon: ListTodo },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'materias', label: 'Matérias', icon: BookOpen },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ] as const;

  return (
    <aside className="w-64 bg-[#050b1a]/80 backdrop-blur-2xl border-r border-white/[0.06] flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none shadow-2xl z-20">
      <div className="p-5 flex flex-col">
        {/* Perfil do Aluno ou Botão de Login */}
        {isAuthenticated ? (
          <div
            onClick={() => setCurrentTab('configuracoes')}
            className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-cyan-400/40 hover:bg-white/[0.06] transition-all duration-300 cursor-pointer group shadow-sm"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-sky-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 group-hover:scale-105 transition-all duration-300">
                <User className="w-5 h-5" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#050b1a] shadow-sm animate-pulse-glow" />
            </div>
            <div className="overflow-hidden min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
                  {user?.nome || 'Estudante'}
                </h3>
                {user?.is_admin && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase shrink-0">
                    ADM
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5 font-normal">
                {user?.escola || 'Escola Municipal'}
              </p>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setCurrentTab('auth')}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 shadow-md mb-6 cursor-pointer hover:border-cyan-400/60 hover:bg-cyan-950/50 transition-all duration-300 group"
          >
            <div className="w-9 h-9 rounded-xl bg-cyan-500 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <LogIn className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">Entrar no SIESAL</h3>
              <p className="text-[11px] text-cyan-300">Acesse sua conta</p>
            </div>
          </div>
        )}

        {/* Divisor sutil */}
        <div className="h-px bg-white/[0.05] my-4" />

        {/* Navegação Principal */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium tracking-wide transition-all duration-200 text-left relative overflow-hidden group ${
                  isActive
                    ? 'text-white bg-gradient-to-r from-cyan-500/20 via-sky-500/10 to-transparent border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
                )}
                <Icon className={`w-4 h-4 transition-all duration-200 ${isActive ? 'text-cyan-400 scale-110' : 'text-slate-400 group-hover:text-cyan-300 group-hover:scale-105'}`} />
                <span className={isActive ? 'font-semibold text-white' : ''}>{item.label}</span>
              </button>
            );
          })}

          {/* Aba Oculta de Administrador: Só aparece se a conta for is_admin */}
          {user?.is_admin && (
            <button
              onClick={() => setCurrentTab('admin')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium tracking-wide transition-all duration-200 text-left relative overflow-hidden group mt-2 ${
                currentTab === 'admin'
                  ? 'text-amber-200 bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-transparent border border-amber-500/40 shadow-sm shadow-amber-500/10'
                  : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-950/20 border border-amber-500/20'
              }`}
            >
              {currentTab === 'admin' && (
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
              )}
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span className="font-bold">Administrador</span>
              <span className="ml-auto text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded uppercase font-mono">
                Root
              </span>
            </button>
          )}
        </nav>
      </div>

      {/* Rodapé da Sidebar */}
      <div className="p-4 border-t border-white/[0.06] bg-black/20 flex items-center justify-between">
        <button
          onClick={onOpenNotifications}
          data-tutorial="btn-notificacoes"
          title="Notificações e Avisos"
          className="relative p-2.5 rounded-xl bg-white/[0.03] text-slate-400 hover:text-cyan-300 hover:bg-white/[0.08] transition-all border border-white/[0.06] hover:border-cyan-500/30"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30">
              {unreadNotificationsCount}
            </span>
          )}
        </button>

        {onOpenTutorial && (
          <button
            onClick={onOpenTutorial}
            data-tutorial="btn-ajuda"
            title="Tutorial Interativo do SIESAL"
            className="p-2.5 rounded-xl bg-white/[0.03] text-slate-400 hover:text-cyan-300 hover:bg-white/[0.08] transition-all border border-white/[0.06] hover:border-cyan-500/30 flex items-center gap-1 text-[11px] font-medium"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Ajuda</span>
          </button>
        )}

        <button
          onClick={() => setCurrentTab('configuracoes')}
          title="Configurações e Perfil"
          className={`p-2.5 rounded-xl transition-all border border-white/[0.06] ${
            currentTab === 'configuracoes'
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              : 'bg-white/[0.03] text-slate-400 hover:text-cyan-300 hover:bg-white/[0.08] hover:border-cyan-500/30'
          }`}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
