import React, { useState } from 'react';
import {
  User, School, Bell, Shield, Database, Save, Trash2, CheckCircle2,
  Download, LogOut, Sparkles, KeyRound, Eye, EyeOff, AlertCircle,
  Palette, RotateCcw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useDialog } from '../components/UI/SiesalDialog';
import { checkPasswordBreach } from '../utils/security';
import {
  ACCENT_THEMES,
  applyAccentTheme,
  applyReducedMotion,
  getPref,
  getStoredAccent,
  setPref,
} from '../utils/appearance';

interface SettingsPageProps {
  onDataReset: () => void;
  onNavigateTab: (tab: any) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onDataReset, onNavigateTab }) => {
  const { user, logout, deleteAccount, updateProfile } = useAuth();
  const dialog = useDialog();
  const [nome, setNome] = useState(user?.nome || 'Estudante');
  const [escola, setEscola] = useState(user?.escola || '');
  const [turma, setTurma] = useState(user?.turma || '');
  // Preferências persistidas (antes os toggles não salvavam nada)
  const [notifSound, setNotifSound] = useState(() => getPref('notif_som', true));
  const [autoReminder, setAutoReminder] = useState(() => getPref('auto_lembrete', true));
  const [accent, setAccent] = useState(() => getStoredAccent());
  const [reducedMotion, setReducedMotion] = useState(() => getPref('reduzir_animacoes', false));
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Formulário de alteração de senha (PUT /api/auth/password)
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [showSenhas, setShowSenhas] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Corrigido: agora o perfil realmente é salvo no backend (PUT /api/auth/profile)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setSavingProfile(true);

    const res = await updateProfile({ nome, escola, turma });
    setSavingProfile(false);

    if (res.success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } else {
      setProfileError(res.error || 'Erro ao salvar as informações.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!senhaAtual || !novaSenha || !confirmarNovaSenha) {
      setPasswordError('Preencha todos os campos para alterar a senha.');
      return;
    }
    if (novaSenha.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarNovaSenha) {
      setPasswordError('As novas senhas não coincidem.');
      return;
    }

    // Segurança v2: recusa senhas conhecidas de vazamentos (HaveIBeenPwned)
    const breach = await checkPasswordBreach(novaSenha);
    if (breach && breach.breached) {
      setPasswordError(
        `Senha insegura: ela já apareceu em vazamentos de dados ${breach.count} vez(es). Escolha uma senha diferente.`
      );
      setChangingPassword(false);
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePassword({ senhaAtual, novaSenha, confirmarNovaSenha });
      setPasswordSuccess('Senha alterada com sucesso! 🔒');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarNovaSenha('');
      setTimeout(() => setPasswordSuccess(null), 4000);
    } catch (err: any) {
      setPasswordError(err.message || 'Erro ao alterar a senha.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    // 1ª confirmação (diálogo integrado do SIESAL)
    const firstOk = await dialog.confirm({
      title: 'Excluir minha conta',
      message: (
        <>
          <strong className="text-rose-300">Atenção:</strong> excluir a conta apaga para sempre
          suas demandas, matérias, eventos e notificações salvas no MySQL. Esta ação é
          irreversível (direito de esquecimento — LGPD).
        </>
      ),
      confirmLabel: 'Continuar',
      cancelLabel: 'Cancelar',
      danger: true,
      icon: 'warning',
    });
    if (!firstOk) return;

    // 2ª confirmação: digitar DELETAR
    const typed = await dialog.prompt({
      title: 'Confirmação final',
      message: 'Digite DELETAR (em maiúsculas) para confirmar a exclusão definitiva:',
      typeThis: 'DELETAR',
      icon: 'warning',
    });
    if (typed !== 'DELETAR') {
      await dialog.alert({
        title: 'Ação cancelada',
        message: 'A exclusão foi cancelada. Sua conta continua ativa. Ufa! 😅',
        icon: 'success',
      });
      return;
    }

    setDeleting(true);
    const res = await deleteAccount();
    setDeleting(false);
    if (res.success) {
      await dialog.alert({
        title: 'Conta excluída',
        message: 'Sua conta e todos os dados associados foram excluídos com sucesso. Obrigado por utilizar o SIESAL!',
        icon: 'success',
      });
      onNavigateTab('auth');
    } else {
      await dialog.alert({
        title: 'Erro ao excluir',
        message: res.error || 'Tente novamente mais tarde.',
        icon: 'warning',
        danger: true,
      });
    }
  };

  const handleClearData = async () => {
    const ok = await dialog.confirm({
      title: 'Limpar atividades em cache',
      message: 'Isso apaga as demandas, eventos e notificações guardados no navegador (modo offline). Seus dados no servidor NÃO são afetados.',
      confirmLabel: 'Limpar cache',
      danger: true,
      icon: 'warning',
    });
    if (!ok) return;
    api.clearAllData();
    onDataReset();
    await dialog.alert({
      title: 'Cache limpo',
      message: 'Os dados locais em cache foram removidos com sucesso.',
      icon: 'success',
    });
  };

  const handleExportBackup = async () => {
    // Backup COMPLETO (v2): perfil + demandas + matérias + eventos + notificações
    const backupData: Record<string, any> = {
      usuario: user,
      temaDeCor: accent,
      dataExportacao: new Date().toISOString(),
      versao: 'SIESAL 2.0',
    };

    try {
      const [demandsData, subjectsData, eventsData, notificationsData] = await Promise.all([
        api.getDemands(),
        api.getSubjects(),
        api.getEvents(),
        api.getNotifications(),
      ]);
      backupData.demandas = demandsData || [];
      backupData.materias = subjectsData || [];
      backupData.eventos = eventsData || [];
      backupData.notificacoes = notificationsData || [];
    } catch {
      // Se o servidor estiver indisponível, exporta pelo menos os dados locais
      backupData.observacao = 'Exportado com o servidor offline — contém apenas o perfil.';
    }

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `siesal-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    // Libera a URL do blob (evita vazamento de memória)
    URL.revokeObjectURL(url);

    await dialog.alert({
      title: 'Backup gerado 📦',
      message: `Arquivo salvo com ${backupData.demandas?.length ?? 0} demandas, ${backupData.materias?.length ?? 0} matérias, ${backupData.eventos?.length ?? 0} eventos e ${backupData.notificacoes?.length ?? 0} notificações.`,
      icon: 'success',
    });
  };

  /** Restaura o visual original do SIESAL (ciano + animações ativas). */
  const handleResetAppearance = () => {
    applyAccentTheme('ciano');
    setAccent('ciano');
    applyReducedMotion(false);
    setReducedMotion(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Cabeçalho */}
      <div className="siesal-card rounded-2xl p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <User className="w-5 h-5 text-cyan-400" />
            Configurações e Perfil
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Personalize suas informações escolares, notificações e preferências do sistema.
          </p>
        </div>

        {savedSuccess && (
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-pulse-glow">
            <CheckCircle2 className="w-4 h-4" />
            <span>Configurações Salvas!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bloco 1: Perfil do Estudante */}
        <div className="siesal-card rounded-2xl p-6 flex flex-col justify-between" data-tutorial="perfil-escolar">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.06]">
              <School className="w-4 h-4 text-cyan-400" />
              Perfil Escolar
            </h3>

            {profileError && (
              <div className="mb-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Nome do Aluno</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-cyan-400/60 transition-all"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Instituição de Ensino</label>
                <input
                  type="text"
                  value={escola}
                  onChange={(e) => setEscola(e.target.value)}
                  placeholder="Ex: Escola Municipal..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-cyan-400/60 transition-all"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Série / Turma</label>
                <input
                  type="text"
                  value={turma}
                  onChange={(e) => setTurma(e.target.value)}
                  placeholder="Ex: 9º Ano B"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#091432] border border-[#1d3b7d] text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full siesal-button-primary text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md mt-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingProfile ? 'Salvando...' : 'Salvar Informações'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Bloco 2: Alterar Senha */}
        <div className="siesal-card rounded-2xl p-6 flex flex-col justify-between" data-tutorial="alterar-senha">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.06]">
              <KeyRound className="w-4 h-4 text-cyan-400" />
              Alterar Senha de Acesso
            </h3>

            {passwordError && (
              <div className="mb-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}
            {passwordSuccess && (
              <div className="mb-3 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Senha Atual</label>
                <input
                  type={showSenhas ? 'text' : 'password'}
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-cyan-400/60 transition-all"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Nova Senha</label>
                <input
                  type={showSenhas ? 'text' : 'password'}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-cyan-400/60 transition-all"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Confirmar Nova Senha</label>
                <input
                  type={showSenhas ? 'text' : 'password'}
                  value={confirmarNovaSenha}
                  onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-cyan-400/60 transition-all"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSenhas}
                    onChange={(e) => setShowSenhas(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-cyan-500 cursor-pointer"
                  />
                  Mostrar senhas
                </label>

                <button
                  type="button"
                  onClick={() => setShowSenhas((v) => !v)}
                  className="text-slate-400 hover:text-cyan-400 transition-colors"
                  tabIndex={-1}
                  aria-label={showSenhas ? 'Ocultar senhas' : 'Mostrar senhas'}
                >
                  {showSenhas ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={changingPassword}
                className="w-full siesal-button-primary text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md mt-1 disabled:opacity-50"
              >
                <Shield className="w-4 h-4" />
                <span>{changingPassword ? 'Alterando...' : 'Alterar Senha'}</span>
              </button>

              <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                🔒 A nova senha é verificada na hora contra bases públicas de vazamentos
                (HaveIBeenPwned) — senhas já vazadas são recusadas, e sua senha nunca sai do seu
                computador.
              </p>
            </form>
          </div>
        </div>

        {/* Bloco 3: Aparência e Personalização */}
        <div className="siesal-card rounded-3xl p-6" data-tutorial="aparencia">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4 pb-3 border-b border-[#1b3472]">
            <Palette className="w-5 h-5 text-cyan-400" />
            Aparência e Personalização
          </h3>

          <div className="space-y-4 text-xs">
            {/* Tema de cor */}
            <div>
              <h4 className="font-bold text-white">Cor de Destaque do Sistema</h4>
              <p className="text-slate-400 text-[11px] mt-0.5 mb-3">
                Aplicada na hora em toda a interface e lembrada neste navegador.
              </p>

              <div className="flex flex-wrap gap-2">
                {ACCENT_THEMES.map((t) => {
                  const selected = accent === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setAccent(t.id);
                        applyAccentTheme(t.id);
                      }}
                      className={`px-3 py-2 rounded-xl border flex items-center gap-2 text-[11px] font-semibold transition-all ${
                        selected
                          ? 'border-white/50 bg-white/[0.06] text-white shadow-md'
                          : 'border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/25 hover:text-white'
                      }`}
                      title={`Tema ${t.nome}`}
                    >
                      <span
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{
                          backgroundColor: t.swatch,
                          boxShadow: selected ? `0 0 10px ${t.swatch}` : undefined,
                        }}
                      />
                      {t.nome}
                      {selected && (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: t.swatch }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reduzir animações */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0a1535] border border-[#1d3876]">
              <div>
                <h4 className="font-bold text-white">Reduzir Animações</h4>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Desativa efeitos de movimento em toda a interface
                </p>
              </div>
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(e) => {
                  setReducedMotion(e.target.checked);
                  applyReducedMotion(e.target.checked);
                }}
                className="w-5 h-5 rounded accent-cyan-500 bg-[#080f24] border-slate-600 focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Restaurar padrões */}
            <button
              type="button"
              onClick={handleResetAppearance}
              className="w-full p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-cyan-400" />
              <span>Restaurar Padrões (ciano + animações)</span>
            </button>
          </div>
        </div>

        {/* Bloco 4: Notificações & Alertas */}
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
                  <p className="text-slate-400 text-[11px] mt-0.5">Bipe discreto quando chegar um novo aviso</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifSound}
                  onChange={(e) => {
                    setNotifSound(e.target.checked);
                    setPref('notif_som', e.target.checked);
                  }}
                  className="w-5 h-5 rounded accent-cyan-500 bg-[#080f24] border-slate-600 focus:ring-0 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0a1535] border border-[#1d3876]">
                <div>
                  <h4 className="font-bold text-white">Lembretes de Prazos</h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">Ativa o lembrete 24h antes por padrão ao criar demandas</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoReminder}
                  onChange={(e) => {
                    setAutoReminder(e.target.checked);
                    setPref('auto_lembrete', e.target.checked);
                  }}
                  className="w-5 h-5 rounded accent-cyan-500 bg-[#080f24] border-slate-600 focus:ring-0 cursor-pointer"
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

        {/* Bloco 4: Segurança da Conta */}
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

            <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-cyan-300">
              <span className="text-slate-400 block mb-1">Autenticação:</span>
              <p className="font-bold text-white">
                Disponível via e-mail/senha ou login com Google (OAuth 2.0) na tela de login.
              </p>
            </div>
          </div>
        </div>

        {/* Bloco 5: Gestão de Dados & Backup */}
        <div className="siesal-card rounded-3xl p-6 flex flex-col justify-between md:col-span-2" data-tutorial="gestao-dados">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4 pb-3 border-b border-[#1b3472]">
              <Database className="w-5 h-5 text-cyan-400" />
              Gestão de Dados
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
                className="w-full p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 font-semibold flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-amber-400" />
                  <span>Limpar Atividades em Cache</span>
                </div>
                <span className="text-[10px] text-amber-400">Reset</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="w-full p-3 rounded-xl bg-rose-950/30 hover:bg-rose-950/60 border border-rose-500/30 hover:border-rose-500/60 text-rose-300 font-semibold flex items-center justify-between transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>{deleting ? 'Excluindo conta...' : 'Excluir Minha Conta Permanentemente'}</span>
                </div>
                <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-mono">
                  LGPD
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  logout();
                  onNavigateTab('auth');
                }}
                className="w-full p-3 rounded-xl bg-white/[0.03] hover:bg-amber-950/40 border border-white/[0.08] hover:border-amber-500/40 text-slate-300 hover:text-amber-300 font-semibold flex items-center justify-between transition-colors"
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
