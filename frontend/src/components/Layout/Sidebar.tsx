import React from 'react';
import { Home, ListTodo, Calendar, BookOpen, Bell, Settings, User, LogIn, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentTab: 'inicio' | 'demandas' | 'agenda' | 'materias' | 'configuracoes' | 'auth';
  setCurrentTab: (tab: 'inicio' | 'demandas' | 'agenda' | 'materias' | 'configuracoes' | 'auth') => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenNotifications,
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
    <aside className="w-64 bg-[#0a1432] border-r border-[#1a2f60] flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none shadow-2xl">
      <div className="p-5 flex flex-col">
        {/* Perfil do Aluno ou Botão de Login */}
        {isAuthenticated ? (
          <div
            onClick={() => setCurrentTab('configuracoes')}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#11224d]/90 border border-[#1e3c80] shadow-md mb-8 cursor-pointer hover:border-cyan-400 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <User className="w-7 h-7" />
            </div>
            <div className="overflow-hidden">
              <h3 className="text-sm font-bold text-white truncate">
                {user?.nome || 'Estudante'}
              </h3>
              <p className="text-xs text-cyan-400 font-medium truncate flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                {user?.escola || 'Escola Municipal'}
                {user?.turma && <span className="text-slate-400 text-[10px]">({user.turma})</span>}
              </p>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setCurrentTab('auth')}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-cyan-950/80 to-blue-950/80 border border-cyan-500/50 shadow-lg mb-8 cursor-pointer hover:scale-102 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500 text-white flex items-center justify-center shadow-md">
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Login / Inscrição</h3>
              <p className="text-[11px] text-cyan-300">Entre na sua conta</p>
            </div>
          </div>
        )}

        {/* Navegação Principal */}
        <nav className="space-y-2.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl font-medium text-sm transition-all duration-200 text-left ${
                  isActive
                    ? 'bg-gradient-to-r from-[#00b4d8] to-[#0077b6] text-white shadow-lg shadow-cyan-500/30 translate-x-1 font-semibold'
                    : 'text-slate-300 hover:bg-[#13275c] hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-cyan-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Rodapé da Sidebar com Botões de Ação */}
      <div className="p-5 border-t border-[#1a2f60]/80 bg-[#080f28]/60 flex items-center justify-around">
        <button
          onClick={onOpenNotifications}
          title="Notificações e Avisos"
          className="relative p-3 rounded-xl bg-[#13275c] text-cyan-300 hover:bg-cyan-500 hover:text-white transition-all shadow-md hover:scale-105"
        >
          <Bell className="w-5 h-5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center border-2 border-[#0a1432]">
              {unreadNotificationsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setCurrentTab('configuracoes')}
          title="Configurações e Perfil"
          className={`p-3 rounded-xl transition-all shadow-md hover:scale-105 ${
            currentTab === 'configuracoes'
              ? 'bg-cyan-500 text-white shadow-cyan-500/30'
              : 'bg-[#13275c] text-cyan-300 hover:bg-cyan-500 hover:text-white'
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
};
