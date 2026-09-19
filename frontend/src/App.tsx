import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { DashboardPage } from './pages/DashboardPage';
import { DemandsPage } from './pages/DemandsPage';
import { AgendaPage } from './pages/AgendaPage';
import { SubjectsPage } from './pages/SubjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { DemandModal } from './components/Demands/DemandModal';
import { EventModal } from './components/Agenda/EventModal';
import { SubjectModal } from './components/Subjects/SubjectModal';
import { NotificationDrawer } from './components/Notifications/NotificationDrawer';
import { api } from './services/api';
import { Tarefa, Marcador, Evento, Notificacao, DashboardStats } from './types';
import { useAuth } from './context/AuthContext';

export const App: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [currentTab, setCurrentTab] = useState<'inicio' | 'demandas' | 'agenda' | 'materias' | 'configuracoes' | 'auth'>('inicio');

  // Modais
  const [isAddDemandOpen, setIsAddDemandOpen] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

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
      setNotifications(notificationsData || []);
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

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  // Handlers de Demandas
  const handleCreateDemand = async (data: any) => {
    await api.createDemand(data);
    await loadData();
  };

  const handleToggleDemandStatus = async (id: number) => {
    await api.toggleDemandStatus(id);
    await loadData();
  };

  const handleDeleteDemand = async (id: number) => {
    await api.deleteDemand(id);
    await loadData();
  };

  // Handlers de Matérias
  const handleCreateSubject = async (data: { nome: string; cor: string }) => {
    await api.createSubject(data);
    await loadData();
  };

  const handleDeleteSubject = async (id: number) => {
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
        unreadNotificationsCount={unreadNotificationsCount}
      />

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onOpenAddDemand={() => setIsAddDemandOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onNavigateAuth={() => setCurrentTab('auth')}
          onNavigateSettings={() => setCurrentTab('configuracoes')}
          unreadCount={unreadNotificationsCount}
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'inicio' && (
            <DashboardPage
              stats={stats}
              onMarkAlertRead={handleMarkNotificationAsRead}
            />
          )}

          {currentTab === 'demandas' && (
            <DemandsPage
              demands={demands}
              subjects={subjects}
              onToggleStatus={handleToggleDemandStatus}
              onDeleteDemand={handleDeleteDemand}
              onOpenAddDemand={() => setIsAddDemandOpen(true)}
              onOpenAddSubject={() => setIsAddSubjectOpen(true)}
            />
          )}

          {currentTab === 'agenda' && (
            <AgendaPage
              events={events}
              demands={demands}
              onOpenAddEvent={() => setIsAddEventOpen(true)}
              onOpenAddDemand={() => setIsAddDemandOpen(true)}
            />
          )}

          {currentTab === 'materias' && (
            <SubjectsPage
              subjects={subjects}
              demands={demands}
              onOpenAddSubject={() => setIsAddSubjectOpen(true)}
              onDeleteSubject={handleDeleteSubject}
              onSelectSubjectFilter={() => {
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

      {/* Modais Globais */}
      <DemandModal
        isOpen={isAddDemandOpen}
        onClose={() => setIsAddDemandOpen(false)}
        subjects={subjects}
        onSubmit={handleCreateDemand}
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
