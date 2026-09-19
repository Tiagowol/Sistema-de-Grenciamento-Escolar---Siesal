import React, { useState } from 'react';
import { User, School, Bell, Shield, Database, Save, Trash2, CheckCircle2, Download, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface SettingsPageProps {
  onDataReset: () => void;
  onNavigateTab: (tab: any) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onDataReset, onNavigateTab }) => {
  const { user, logout } = useAuth();
  const [nome, setNome] = useState(user?.nome || 'Estudante');
  const [escola, setEscola] = useState(user?.escola || 'Escola Municipal');
  const [turma, setTurma] = useState(user?.turma || '9º Ano - Turma B');
  const [notifSound, setNotifSound] = useState(true);
  const [autoReminder, setAutoReminder] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleClearData = () => {
    if (window.confirm('Tem certeza de que deseja apagar todas as demandas e dados salvos?')) {
      api.clearAllData();
      onDataReset();
      alert('Dados limpos com sucesso!');
    }
  };

  const handleExportBackup = () => {
    const backupData = {
      usuario: user,
      dataExportacao: new Date().toISOString(),
      versao: 'SIESAL 1.0',
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `siesal-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Cabeçalho */}
      <div className="siesal-card rounded-3xl p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
            <User className="w-6 h-6 text-cyan-400" />
            Configurações e Perfil
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Personalize suas informações escolares, notificações e preferências do sistema.
          </p>
        </div>

        {savedSuccess && (
          <div className="px-4 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            <span>Configurações Salvas!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bloco 1: Perfil do Estudante */}
        <div className="siesal-card rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4 pb-3 border-b border-[#1b3472]">
              <School className="w-5 h-5 text-cyan-400" />
              Perfil Escolar
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Nome do Aluno</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#091432] border border-[#1d3b7d] text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Instituição de Ensino</label>
                <input
                  type="text"
                  value={escola}
                  onChange={(e) => setEscola(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#091432] border border-[#1d3b7d] text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Série / Turma</label>
                <input
                  type="text"
                  value={turma}
                  onChange={(e) => setTurma(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#091432] border border-[#1d3b7d] text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                className="w-full siesal-button-primary text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md mt-2"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Informações</span>
              </button>
            </form>
          </div>
        </div>

        {/* Bloco 2: Notificações & Alertas */}
        <div className="siesal-card rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4 pb-3 border-b border-[#1b3472]">
              <Bell className="w-5 h-5 text-cyan-400" />
              Notificações e Avisos
            </h3>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0a1535] border border-[#1d3876]">
                <div>
                  <h4 className="font-bold text-white">Alertas Sonoros</h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">Tocar som discreto em novos avisos</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifSound}
                  onChange={(e) => setNotifSound(e.target.checked)}
                  className="w-5 h-5 rounded text-cyan-500 bg-[#080f24] border-slate-600 focus:ring-0 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0a1535] border border-[#1d3876]">
                <div>
                  <h4 className="font-bold text-white">Lembretes de Prazos</h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">Aviso automático 24h antes da entrega</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoReminder}
                  onChange={(e) => setAutoReminder(e.target.checked)}
                  className="w-5 h-5 rounded text-cyan-500 bg-[#080f24] border-slate-600 focus:ring-0 cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span>Dica de Produtividade</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Organize suas matérias por cores para identificar prazos rapidamente no calendário!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bloco 3: Segurança */}
        <div className="siesal-card rounded-3xl p-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4 pb-3 border-b border-[#1b3472]">
            <Shield className="w-5 h-5 text-cyan-400" />
            Segurança da Conta (NF03)
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#0a1535] border border-[#1d3876]">
              <span className="text-slate-400">Proteção Ativa:</span>
              <p className="font-bold text-emerald-400 mt-1">
                Bloqueio ativado após 5 tentativas incorretas de senha.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0a1535] border border-[#1d3876]">
              <span className="text-slate-400">E-mail Cadastrado:</span>
              <p className="font-bold text-white mt-1">{user?.email || 'aluno@escola.gov.br'}</p>
            </div>
          </div>
        </div>

        {/* Bloco 4: Gestão de Dados & Backup */}
        <div className="siesal-card rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4 pb-3 border-b border-[#1b3472]">
              <Database className="w-5 h-5 text-cyan-400" />
              Gestão de Dados
            </h3>

            <div className="space-y-3 text-xs">
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full p-3 rounded-xl bg-[#0a1535] hover:bg-[#122860] border border-[#1d3876] text-slate-200 font-bold flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>Exportar Dados (Backup JSON)</span>
                </div>
                <span className="text-[10px] text-cyan-400 font-mono">.json</span>
              </button>

              <button
                type="button"
                onClick={handleClearData}
                className="w-full p-3 rounded-xl bg-rose-950/40 hover:bg-rose-950/80 border border-rose-500/40 text-rose-300 font-bold flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>Limpar Todas as Atividades</span>
                </div>
                <span className="text-[10px] text-rose-400">Reset</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  logout();
                  onNavigateTab('auth');
                }}
                className="w-full p-3 rounded-xl bg-[#0d1c44] hover:bg-amber-950/60 border border-[#203c7e] hover:border-amber-500/50 text-slate-300 hover:text-amber-300 font-bold flex items-center justify-between transition-colors mt-2"
              >
                <div className="flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  <span>Encerrar Sessão</span>
                </div>
                <span className="text-[10px]">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
