import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, Server, Database, Users, Bell, AlertTriangle,
  Clock, Activity, RefreshCw, Send, Trash2, CheckCircle2,
  HardDrive, Cpu, Radio, Power, LockOpen, Pencil,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../components/UI/SiesalDialog';

export const AdminPage: React.FC = () => {
  const { user: adminUser } = useAuth();
  const dialog = useDialog();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingUserId, setActingUserId] = useState<number | null>(null);

  // Formulário de Broadcast de Manutenção
  const [noticeTitle, setNoticeTitle] = useState('⚠️ Manutenção Programada do Sistema');
  const [noticeMessage, setNoticeMessage] = useState('O sistema passará por melhorias na infraestrutura hoje às 22h. Salve suas demandas com antecedência.');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

  // Limpeza de notificações
  const [purging, setPurging] = useState(false);

  const loadAdminData = async () => {
    try {
      setRefreshing(true);
      const [statsData, usersData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
      ]);
      setStats(statsData);
      setUsers(usersData || []);
    } catch (err: any) {
      console.error('Erro ao carregar dados administrativos:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAdminData();
    const interval = setInterval(loadAdminData, 10000); // Polling a cada 10s
    return () => clearInterval(interval);
  }, []);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeMessage.trim()) return;

    setBroadcasting(true);
    setBroadcastSuccess(null);
    try {
      const res = await api.broadcastMaintenance({
        titulo: noticeTitle,
        mensagem: noticeMessage,
      });
      setBroadcastSuccess(res.message || 'Aviso transmitido com sucesso!');
      setTimeout(() => setBroadcastSuccess(null), 5000);
    } catch (err: any) {
      await dialog.alert({
        title: 'Erro ao enviar aviso',
        message: err.message || 'Falha na comunicação com o servidor.',
        icon: 'warning',
        danger: true,
      });
    } finally {
      setBroadcasting(false);
    }
  };

  const handlePurgeNotifications = async () => {
    const ok = await dialog.confirm({
      title: 'Purgar notificações lidas',
      message: 'Excluir as notificações já lidas de TODOS os usuários para otimizar as tabelas do MySQL?',
      confirmLabel: 'Executar purga',
      icon: 'warning',
    });
    if (!ok) return;
    setPurging(true);
    try {
      const res = await api.purgeAdminNotifications();
      await dialog.alert({
        title: 'Purga concluída',
        message: res.message,
        icon: 'success',
      });
      loadAdminData();
    } catch (err: any) {
      await dialog.alert({
        title: 'Erro na purga',
        message: err.message || 'Falha na comunicação com o servidor.',
        icon: 'warning',
        danger: true,
      });
    } finally {
      setPurging(false);
    }
  };

  // ── Gestão de contas (v2) ──

  const handleToggleUserStatus = async (u: any) => {
    const desativando = u.status === true;
    const ok = await dialog.confirm({
      title: desativando ? 'Desativar conta' : 'Reativar conta',
      message: (
        <>
          {desativando ? (
            <>
              A conta de <strong className="text-slate-100">{u.nome}</strong> ({u.email}){' '}
              <strong className="text-rose-300">deixará de conseguir fazer login</strong> até ser
              reativada. Os dados dela são preservados.
            </>
          ) : (
            <>
              A conta de <strong className="text-slate-100">{u.nome}</strong> voltará a conseguir
              fazer login normalmente.
            </>
          )}
        </>
      ),
      confirmLabel: desativando ? 'Desativar' : 'Reativar',
      danger: desativando,
      icon: desativando ? 'warning' : 'question',
    });
    if (!ok) return;

    setActingUserId(u.id_usuario);
    try {
      const res = await api.adminSetUserStatus(u.id_usuario, !u.status);
      await dialog.alert({ title: 'Sucesso', message: res.message, icon: 'success' });
      loadAdminData();
    } catch (err: any) {
      await dialog.alert({ title: 'Erro', message: err.message, icon: 'warning', danger: true });
    } finally {
      setActingUserId(null);
    }
  };

  const handleUnlockUser = async (u: any) => {
    setActingUserId(u.id_usuario);
    try {
      const res = await api.adminUnlockUser(u.id_usuario);
      await dialog.alert({
        title: 'Conta desbloqueada 🔓',
        message: res.message,
        icon: 'success',
      });
      loadAdminData();
    } catch (err: any) {
      await dialog.alert({ title: 'Erro', message: err.message, icon: 'warning', danger: true });
    } finally {
      setActingUserId(null);
    }
  };

  const handleDeleteUser = async (u: any) => {
    const ok = await dialog.confirm({
      title: 'Excluir usuário',
      message: (
        <>
          Excluir <strong className="text-slate-100">{u.nome}</strong> ({u.email}) e{' '}
          <strong className="text-rose-300">todos os seus dados</strong> (demandas, eventos,
          matérias e notificações)? Conformidade com a LGPD — ação irreversível.
        </>
      ),
      confirmLabel: 'Excluir usuário',
      danger: true,
      icon: 'warning',
    });
    if (!ok) return;

    setActingUserId(u.id_usuario);
    try {
      const res = await api.adminDeleteUser(u.id_usuario);
      await dialog.alert({ title: 'Usuário excluído', message: res.message, icon: 'success' });
      loadAdminData();
    } catch (err: any) {
      await dialog.alert({ title: 'Erro', message: err.message, icon: 'warning', danger: true });
    } finally {
      setActingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-cyan-400 gap-3">
        <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
        <span className="text-xs font-semibold tracking-wider uppercase text-slate-300">Carregando Painel Administrativo Seguro...</span>
      </div>
    );
  }

  const db = stats?.database || {};
  const srv = stats?.server || {};

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Cabeçalho da Área Restrita */}
      <div className="siesal-card rounded-2xl p-6 border-l-4 border-l-amber-500 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-wide">
                Painel do Administrador • SIESAL V2
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase tracking-wider">
                Exclusivo & Oculto
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitoramento em tempo real do servidor, conexões ativas, banco MySQL e ferramentas de manutenção.
            </p>
          </div>
        </div>

        <button
          onClick={loadAdminData}
          disabled={refreshing}
          className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-cyan-300 border border-white/[0.08] text-xs font-semibold flex items-center gap-2 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
          <span>{refreshing ? 'Atualizando...' : 'Atualizar Métricas'}</span>
        </button>
      </div>

      {/* Grid de Métricas de Infraestrutura */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Tempo Online (Uptime) */}
        <div className="siesal-card rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" />
              Tempo Online
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse-glow" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight mt-1">
            {stats?.uptimeFormatted || '0s'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Servidor ativo e respondendo
          </p>
        </div>

        {/* Card 2: Conexão com o Banco MySQL */}
        <div className="siesal-card rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4 text-sky-400" />
              Banco MySQL
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                db.connected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500'
              }`}
            />
          </div>
          <div className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <span>{db.connected ? 'Conectado' : 'Desconectado'}</span>
            {db.connected && (
              <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                {db.latencyMs}ms
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {db.engine || 'Prisma ORM'}
          </p>
        </div>

        {/* Card 3: Uso de Memória do Processo */}
        <div className="siesal-card rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-purple-400" />
              Uso de Memória
            </span>
            <Activity className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight mt-1">
            {srv.memoryRssMb ? `${srv.memoryRssMb} MB` : 'N/A'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Heap: {srv.memoryHeapMb || '0'} MB • {srv.nodeVersion || 'Node.js'}
          </p>
        </div>

        {/* Card 4: Total de Estudantes Ativos */}
        <div className="siesal-card rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-400" />
              Alunos Cadastrados
            </span>
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight mt-1">
            {db.totalUsers ?? users.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {db.totalUsers ?? users.length} cadastrados • {db.newSignups7d ?? 0} novos nos últimos 7 dias
          </p>
        </div>

        {/* Card 5: Demandas Atrasadas */}
        <div className="siesal-card rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Atrasadas
            </span>
            <Pencil className="w-3.5 h-3.5 text-rose-400/50" />
          </div>
          <div className="text-xl font-bold text-rose-400 tracking-tight mt-1">
            {db.demandsOverdue ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Prazo vencido e não concluídas (soma de todos os alunos)
          </p>
        </div>
      </div>

      {/* Seção 2: Ferramentas de Manutenção & Transmissão Global */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Painel de Transmissão de Avisos de Manutenção */}
        <div className="lg:col-span-7 siesal-card rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.06]">
            <Radio className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                Transmitir Aviso de Manutenção para Todos os Usuários
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Envia instantaneamente uma notificação push no sino de todos os alunos da plataforma.
              </p>
            </div>
          </div>

          {broadcastSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs font-semibold flex items-center gap-2 mb-4 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{broadcastSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSendBroadcast} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Título do Aviso</label>
              <input
                type="text"
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
                placeholder="Ex: ⚠️ Manutenção do Servidor"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-amber-400/60"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Mensagem aos Alunos</label>
              <textarea
                rows={3}
                value={noticeMessage}
                onChange={(e) => setNoticeMessage(e.target.value)}
                placeholder="Descreva a manutenção, horário de retorno e orientações..."
                className="w-full p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-amber-400/60 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                Destinatários: Todos os alunos registrados no MySQL
              </span>

              <button
                type="submit"
                disabled={broadcasting}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-xs shadow-md hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{broadcasting ? 'Transmitindo...' : 'Transmitir Aviso'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Ações de Limpeza e Manutenção de Banco */}
        <div className="lg:col-span-5 space-y-4">
          <div className="siesal-card rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06]">
              <Server className="w-4 h-4 text-cyan-400" />
              Rotinas de Manutenção
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <h4 className="font-semibold text-slate-200">Limpeza de Notificações Lidas</h4>
                <p className="text-[11px] text-slate-400 mt-1 mb-3">
                  Exclui notificações já abertas para otimizar espaço nas tabelas do MySQL.
                </p>
                <button
                  type="button"
                  onClick={handlePurgeNotifications}
                  disabled={purging}
                  className="w-full py-2 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] font-semibold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>{purging ? 'Limpando...' : 'Executar Purga de Avisos Lidos'}</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-cyan-300 text-[11px] leading-relaxed">
                <span className="font-bold block mb-1">🔐 Gestão Restrita de Privilégios:</span>
                Por diretriz de alta segurança, novas permissões de Administrador só podem ser concedidas diretamente através do <strong>Console de Debug</strong> (<code>npm --prefix backend run console</code>) usando o comando:
                <code className="block mt-1.5 p-1 rounded bg-black/40 text-cyan-400 font-mono text-[10px]">
                  grant-admin email@escola.gov.br
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seção 3: Tabela de Usuários Cadastrados */}
      <div className="siesal-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.06] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Usuários Registrados no Sistema</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Total: {users.length} conta(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-slate-400 text-[11px]">
                <th className="pb-2.5 font-semibold">ID</th>
                <th className="pb-2.5 font-semibold">Nome Completo</th>
                <th className="pb-2.5 font-semibold">E-mail Institucional</th>
                <th className="pb-2.5 font-semibold">Escola / Série</th>
                <th className="pb-2.5 font-semibold">Demandas</th>
                <th className="pb-2.5 font-semibold">Perfil</th>
                <th className="pb-2.5 font-semibold">Status</th>
                <th className="pb-2.5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {users.map((u) => {
                const bloqueado =
                  u.bloqueado_ate && new Date(u.bloqueado_ate) > new Date();
                const isSelf = adminUser?.id_usuario === u.id_usuario;
                const acting = actingUserId === u.id_usuario;

                return (
                <tr key={u.id_usuario} className={`hover:bg-white/[0.02] transition-colors ${!u.status ? 'opacity-60' : ''}`}>
                  <td className="py-2.5 font-mono text-slate-500">#{u.id_usuario}</td>
                  <td className="py-2.5 font-semibold text-slate-200">{u.nome}</td>
                  <td className="py-2.5 text-slate-400 font-mono text-[11px]">{u.email}</td>
                  <td className="py-2.5 text-slate-300">
                    {u.escola || 'Não inf.'} {u.turma ? `(${u.turma})` : ''}
                  </td>
                  <td className="py-2.5 text-slate-300">
                    {u._count?.tarefas || 0}
                  </td>
                  <td className="py-2.5">
                    {u.is_admin ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                        ADMIN
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-medium">
                        ALUNO
                      </span>
                    )}
                  </td>
                  <td className="py-2.5">
                    {bloqueado ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-bold">
                        Bloqueado (NF03)
                      </span>
                    ) : u.status ? (
                      <span className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Ativo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="py-2.5">
                    {isSelf ? (
                      <span className="text-[10px] text-slate-600 italic" title="Você não pode gerir sua própria conta por aqui">
                        (você)
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        {bloqueado && (
                          <button
                            onClick={() => handleUnlockUser(u)}
                            disabled={acting}
                            title="Desbloquear conta (zera tentativas NF03)"
                            className="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 transition-colors disabled:opacity-40"
                          >
                            <LockOpen className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          disabled={acting}
                          title={u.status ? 'Desativar conta' : 'Reativar conta'}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                            u.status
                              ? 'text-slate-500 hover:text-amber-400 hover:bg-amber-950/40'
                              : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        {!u.is_admin && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={acting}
                            title="Excluir usuário e todos os dados (LGPD)"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
