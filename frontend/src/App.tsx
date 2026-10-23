import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { DashboardPage } from './pages/DashboardPage';
import { DemandsPage } from './pages/DemandsPage';
import { AgendaPage } from './pages/AgendaPage';
import { SubjectsPage } from './pages/SubjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { AdminPage } from './pages/AdminPage';
import { GuidedTutorial } from './components/Tutorial/GuidedTutorial';
import { DemandModal } from './components/Demands/DemandModal';
import { EventModal } from './components/Agenda/EventModal';
import { SubjectModal } from './components/Subjects/SubjectModal';
import { NotificationDrawer } from './components/Notifications/NotificationDrawer';
import { useBackendStatus, ConnectingSplash, OfflineGateView } from './components/UI/OfflineGate';
import { useDialog } from './components/UI/SiesalDialog';
import { api } from './services/api';
import { Tarefa, Marcador, Evento, Notificacao, DashboardStats } from './types';
import { useAuth } from './context/AuthContext';
import { getPref, playNotificationSound } from './utils/appearance';
import { ShieldAlert, RefreshCw, Chrome } from 'lucide-react';

// Chave de sessão do fluxo OAuth do Google (compartilhada com a AuthPage)
const OAUTH_STATE_KEY = '@siesal:oauth_state';

type OAuthCallbackStatus = 'idle' | 'processing' | 'error';

type AppTab = 'inicio' | 'demandas' | 'agenda' | 'materias' | 'configuracoes' | 'auth' | 'admin';

/** Mensagens amigáveis para os códigos de erro vindos do backend no callback. */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_nao_configurado:
    'O login com Google ainda não está configurado no servidor. Preencha GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no backend/.env (guia na aba Google do login) e reinicie o backend.',
  google_autorizacao_recusada:
    'Você cancelou a autorização na tela do Google. Nenhum acesso foi concedido — tente novamente quando quiser.',
  state_invalido:
    'Falha de segurança: o parâmetro "state" não confere com o início do fluxo. Volte à tela de login e use o botão do Google novamente.',
  google_codigo_ausente:
    'O Google não devolveu o código de autorização. Tente entrar novamente.',
  google_token_invalido:
    'Não foi possível validar o código de autorização com o Google. Verifique as credenciais no backend e tente novamente.',
  google_perfil_indisponivel:
    'Não foi possível ler seu perfil do Google. Tente novamente em instantes.',
  google_email_nao_verificado:
    'Sua conta Google não possui um e-mail verificado. Verifique o e-mail no Google e tente novamente.',
  conta_desativada:
    'Esta conta foi desativada. Entre em contato com o suporte.',
  google_falha_interna:
    'Erro interno ao concluir o login com Google. Tente novamente.',
};

export const App: React.FC = () => {
  const { user, isAuthenticated, loginWithGoogleCode } = useAuth();
  const dialog = useDialog();
  const { status: backendStatus, recheck: recheckBackend } = useBackendStatus();
  const [currentTab, setCurrentTab] = useState<AppTab>('inicio');

  // Modais
  const [isAddDemandOpen, setIsAddDemandOpen] = useState(false);
  const [editingDemand, setEditingDemand] = useState<Tarefa | null>(null);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  // Estados de dados
  const [demands, setDemands] = useState<Tarefa[]>([]);
  const [subjects, setSubjects] = useState<Marcador[]>([]);
  const [events, setEvents] = useState<Evento[]>([]);
  const [notifications, setNotifications] = useState<Notificacao[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    todosOsPrazos: { total: 0, urgente: 0, proximo: 0, longe: 0, concluido: 0 },
    essaSemana: { total: 0, urgente: 0, proximo: 0, longe: 0, concluido: 0 },
    distribuicaoMaterias: [],
    avisos: [],
  });
  const [loading, setLoading] = useState(true);

  // Contagem anterior de avisos não lidos (para o som de nova notificação)
  const prevUnreadRef = useRef<number | null>(null);

  // Filtro por matéria compartilhado (Matérias → "Ver Demandas" filtra a lista)
  const [subjectFilter, setSubjectFilter] = useState<number | null>(null);

  // ──────────────────────────────────────────────────────────────
  // Callback do login com Google (OAuth 2.0): /oauth/callback?login_code=...&state=...
  // ──────────────────────────────────────────────────────────────
  const [oauthStatus, setOauthStatus] = useState<OAuthCallbackStatus>(() => {
    if (typeof window !== 'undefined') {
      const { pathname } = window.location;
      const params = new URLSearchParams(window.location.search);
      if (pathname.startsWith('/oauth/callback') && (params.has('login_code') || params.has('error'))) {
        return 'processing';
      }
    }
    return 'idle';
  });
  const [oauthError, setOauthError] = useState<string | null>(null);
  const oauthHandled = useRef(false);

  useEffect(() => {
    if (oauthHandled.current || oauthStatus !== 'processing') return;

    const handleOAuthCallback = async () => {
      oauthHandled.current = true;

      const url = new URL(window.location.href);
      const errorParam = url.searchParams.get('error');
      const state = url.searchParams.get('state');
      const loginCode = url.searchParams.get('login_code');

      // Limpa os parâmetros sensíveis da URL imediatamente
      window.history.replaceState({}, document.title, '/oauth/callback');

      // Erro reportado pelo backend/Google
      if (errorParam) {
        setOauthError(
          OAUTH_ERROR_MESSAGES[errorParam] ||
            `O login não foi concluído (${errorParam}). Tente novamente.`
        );
        setOauthStatus('error');
        return;
      }

      // Validação do state (proteção anti-CSRF gerada no botão da AuthPage)
      const savedState = sessionStorage.getItem(OAUTH_STATE_KEY);
      sessionStorage.removeItem(OAUTH_STATE_KEY);

      if (!savedState || !state || savedState !== state) {
        setOauthError(OAUTH_ERROR_MESSAGES.state_invalido);
        setOauthStatus('error');
        return;
      }

      if (!loginCode) {
        setOauthError('Código de login ausente. Reinicie o login com o Google.');
        setOauthStatus('error');
        return;
      }

      // Troca o login_code (uso único, 60 s) pela sessão JWT
      const res = await loginWithGoogleCode(loginCode);

      if (res.success) {
        window.history.replaceState({}, document.title, '/');
        setOauthStatus('idle');
      } else {
        setOauthError(res.error || 'Não foi possível concluir o login com Google.');
        setOauthStatus('error');
      }
    };

    handleOAuthCallback();
  }, [oauthStatus, loginWithGoogleCode]);

  /**
   * Aplica uma lista nova de notificações no estado e toca o bipe quando
   * CHEGAM avisos novos (contagem de não lidas aumentou), respeitando a
   * preferência "Alertas Sonoros" das Configurações.
   * Usado tanto pelo loadData quanto pelo polling em tempo real.
   */
  const applyNotifications = useCallback((list: Notificacao[]) => {
    setNotifications(list);

    const unreadCount = list.filter((n) => !n.lida).length;
    if (
      prevUnreadRef.current !== null &&
      unreadCount > prevUnreadRef.current &&
      getPref('notif_som', true)
    ) {
      playNotificationSound();
    }
    prevUnreadRef.current = unreadCount;
  }, []);

  // Carregar dados
  const loadData = async () => {
    if (!isAuthenticated) return;
    try {
      const [demandsData, subjectsData, eventsData, notificationsData, statsData] = await Promise.all([
        api.getDemands(),
        api.getSubjects(),
        api.getEvents(),
        api.getNotifications(),
        api.getDashboardStats(),
      ]);

      setDemands(demandsData || []);
      setSubjects(subjectsData || []);
      setEvents(eventsData || []);
      applyNotifications(notificationsData || []);
      setStats(statsData || {
        todosOsPrazos: { total: 0, urgente: 0, proximo: 0, longe: 0, concluido: 0 },
        essaSemana: { total: 0, urgente: 0, proximo: 0, longe: 0, concluido: 0 },
        distribuicaoMaterias: [],
        avisos: [],
      });
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // AVISOS EM TEMPO REAL: a cada 12 segundos o SIESAL busca silenciosamente
  // as notificações no servidor. Se chegar um aviso novo (ex.: um comunicado
  // do administrador), o bipe toca e todos os contadores/avisos atualizam
  // sozinhos — sem precisar recarregar nada.
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      // Troca de sessão: o baseline do bipe recomeça (evita beep falso
      // ao logar com outra conta que tenha mais não lidas)
      prevUnreadRef.current = null;
      return;
    }

    const tick = async () => {
      try {
        const fresh = await api.pollNotifications();
        if (fresh) applyNotifications(fresh);
      } catch {
        /* silencioso — o backend pode estar fora do ar */
      }
    };

    const interval = setInterval(tick, 12000);
    return () => clearInterval(interval);
  }, [isAuthenticated, applyNotifications]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();

      // Tour guiado: abre AUTOMATICAMENTE no primeiro login do usuário
      // (uma vez por navegador — depois só pelo botão Ajuda da Sidebar)
      if (!localStorage.getItem('@siesal:tutorial_concluido')) {
        const timer = setTimeout(() => setIsTutorialOpen(true), 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthenticated]);

  /** Encerra o tour guiado e grava que ele já foi apresentado. */
  const handleCloseTutorial = () => {
    localStorage.setItem('@siesal:tutorial_concluido', '1');
    setIsTutorialOpen(false);
  };

  // Abre o modal de demandas (criação ou edição)
  const openDemandModal = (demand?: Tarefa | null) => {
    setEditingDemand(demand || null);
    setIsAddDemandOpen(true);
  };

  // Handlers de Demandas
  const handleCreateDemand = async (data: any) => {
    await api.createDemand(data);
    await loadData();
  };

  /** Edita uma demanda existente (PUT /demands/:id) e fecha o modal. */
  const handleUpdateDemand = async (id: number, data: any) => {
    await api.updateDemand(id, data);
    setIsAddDemandOpen(false);
    setEditingDemand(null);
    await loadData();
  };

  const handleToggleDemandStatus = async (id: number) => {
    await api.toggleDemandStatus(id);
    await loadData();
  };

  const handleDeleteDemand = async (id: number) => {
    const ok = await dialog.confirm({
      title: 'Excluir demanda',
      message: (
        <>
          Tem certeza de que deseja excluir esta demanda?{' '}
          <strong className="text-rose-300">Esta ação não pode ser desfeita.</strong>
        </>
      ),
      confirmLabel: 'Excluir',
      danger: true,
      icon: 'warning',
    });
    if (!ok) return;
    await api.deleteDemand(id);
    await loadData();
  };

  // Handlers de Matérias
  const handleCreateSubject = async (data: { nome: string; cor: string }) => {
    await api.createSubject(data);
    await loadData();
  };

  /** Edita nome/cor de uma matéria (PUT /subjects/:id). */
  const handleUpdateSubject = async (id: number, data: { nome?: string; cor?: string }) => {
    await api.updateSubject(id, data);
    await loadData();
  };

  const handleDeleteSubject = async (id: number) => {
    const ok = await dialog.confirm({
      title: 'Excluir matéria',
      message: (
        <>
          A matéria será removida. As demandas vinculadas a ela <strong className="text-slate-100">não
          são apagadas</strong> — ficam apenas sem matéria (o backend usa <code>onDelete: SetNull</code>).
        </>
      ),
      confirmLabel: 'Excluir matéria',
      danger: true,
      icon: 'warning',
    });
    if (!ok) return;
    await api.deleteSubject(id);
    await loadData();
  };

  // Handlers de Eventos
  const handleCreateEvent = async (data: any) => {
    await api.createEvent(data);
    await loadData();
  };

  // Handlers de Notificações
  const handleMarkNotificationAsRead = async (id: number) => {
    await api.markNotificationAsRead(id);
    await loadData();
  };

  const handleMarkAllNotificationsAsRead = async () => {
    await api.markAllNotificationsAsRead();
    await loadData();
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.lida).length;

  // Avisos do painel Início derivam da lista de notificações ao vivo
  // (atualizada pelo polling) — nunca ficam desatualizados
  const dashboardStats: DashboardStats = useMemo(
    () => ({ ...stats, avisos: notifications.slice(0, 5) }),
    [stats, notifications]
  );

  // Badge de não lidas no título da aba do navegador (ex.: "(3) SIESAL ...")
  useEffect(() => {
    const baseTitle = 'SIESAL - Sistema de Gerenciamento Escolar do Aluno';
    document.title =
      unreadNotificationsCount > 0 ? `(${unreadNotificationsCount}) ${baseTitle}` : baseTitle;
  }, [unreadNotificationsCount]);

  // ── Monitor de conexão: bloqueia o sistema com a tela "Servidor fora do ar" ──
  if (backendStatus === 'checking') {
    return <ConnectingSplash />;
  }

  if (backendStatus === 'offline') {
    return <OfflineGateView onRetry={recheckBackend} />;
  }

  // ── Tela de processamento/erro do callback OAuth ──
  if (oauthStatus !== 'idle') {
    return (
      <div className="min-h-screen bg-[#080f24] text-slate-100 font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-md siesal-card rounded-3xl p-8 border border-cyan-500/40 shadow-2xl text-center">
          {oauthStatus === 'processing' ? (
            <>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 animate-pulse-glow">
                <Chrome className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-white">Concluindo autenticação OAuth...</h2>
              <p className="text-xs text-slate-400 mt-2">
                Validando sua autorização com o Google e emitindo seu
                token de acesso seguro do SIESAL.
              </p>
              <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mt-6" />
            </>
          ) : (
            <>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-white">Autenticação OAuth não concluída</h2>
              <p className="text-xs text-rose-300/90 mt-2 leading-relaxed">{oauthError}</p>
              <button
                onClick={() => {
                  window.history.replaceState({}, document.title, '/');
                  setOauthStatus('idle');
                }}
                className="mt-6 w-full siesal-button-primary text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Voltar à tela de login</span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Se o aluno não estiver autenticado, força a exibição da tela de Login / Inscrição Obrigatória
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#080f24] text-slate-100 font-sans flex items-center justify-center p-4">
        <AuthPage
          onSuccess={() => {
            setCurrentTab('inicio');
            loadData();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#080f24] text-slate-100 font-sans">
      {/* Sidebar Lateral */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenTutorial={() => setIsTutorialOpen(true)}
        unreadNotificationsCount={unreadNotificationsCount}
      />

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onOpenAddDemand={() => openDemandModal()}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onNavigateAuth={() => setCurrentTab('auth')}
          onNavigateSettings={() => setCurrentTab('configuracoes')}
          unreadCount={unreadNotificationsCount}
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'inicio' && (
            <DashboardPage
              stats={dashboardStats}
              onMarkAlertRead={handleMarkNotificationAsRead}
            />
          )}

          {currentTab === 'demandas' && (
            <DemandsPage
              demands={demands}
              subjects={subjects}
              subjectFilter={subjectFilter}
              onSubjectFilterChange={setSubjectFilter}
              onToggleStatus={handleToggleDemandStatus}
              onDeleteDemand={handleDeleteDemand}
              onEditDemand={(d) => openDemandModal(d)}
              onOpenAddDemand={() => openDemandModal()}
              onOpenAddSubject={() => setIsAddSubjectOpen(true)}
            />
          )}

          {currentTab === 'agenda' && (
            <AgendaPage
              events={events}
              demands={demands}
              onOpenAddEvent={() => setIsAddEventOpen(true)}
              onOpenAddDemand={() => openDemandModal()}
            />
          )}

          {currentTab === 'materias' && (
            <SubjectsPage
              subjects={subjects}
              demands={demands}
              onOpenAddSubject={() => setIsAddSubjectOpen(true)}
              onDeleteSubject={handleDeleteSubject}
              onSelectSubjectFilter={(id) => {
                // "Ver Demandas" agora aplica o filtro real da matéria na página de demandas
                setSubjectFilter(id);
                setCurrentTab('demandas');
              }}
            />
          )}

          {currentTab === 'configuracoes' && (
            <SettingsPage
              onDataReset={loadData}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'admin' && user?.is_admin && (
            <AdminPage />
          )}

          {currentTab === 'auth' && (
            <AuthPage
              onSuccess={() => {
                setCurrentTab('inicio');
                loadData();
              }}
            />
          )}
        </main>
      </div>

      {/* Tour guiado: seta apontando para cada função, passo a passo */}
      <GuidedTutorial
        isOpen={isTutorialOpen}
        onClose={handleCloseTutorial}
        onNavigateTab={(tab) => setCurrentTab(tab)}
      />

      <DemandModal
        isOpen={isAddDemandOpen}
        onClose={() => {
          setIsAddDemandOpen(false);
          setEditingDemand(null);
        }}
        subjects={subjects}
        onSubmit={handleCreateDemand}
        editingDemand={editingDemand}
        onUpdate={handleUpdateDemand}
      />

      <EventModal
        isOpen={isAddEventOpen}
        onClose={() => setIsAddEventOpen(false)}
        onSubmit={handleCreateEvent}
      />

      <SubjectModal
        isOpen={isAddSubjectOpen}
        onClose={() => setIsAddSubjectOpen(false)}
        subjects={subjects}
        onCreateSubject={handleCreateSubject}
        onUpdateSubject={handleUpdateSubject}
        onDeleteSubject={handleDeleteSubject}
      />

      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkNotificationAsRead}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
      />
    </div>
  );
};
