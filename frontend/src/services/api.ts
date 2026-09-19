import { Usuario, Marcador, Tarefa, Evento, Notificacao, DashboardStats } from '../types';
import { calculateDynamicPriority } from '../utils/priorityCalculator';

const API_BASE_URL = 'http://localhost:3001/api';

// Armazenamento em memória local limpo (sem dados falsos pré-fixados)
let mockUser: Usuario | null = null;
let mockSubjects: Marcador[] = [];
let mockDemands: Tarefa[] = [];
let mockEvents: Evento[] = [];
let mockNotifications: Notificacao[] = [];

// Inicializa com dados limpos ou recuperados do localStorage
const initLocalState = () => {
  const savedUser = localStorage.getItem('@siesal:user');
  if (savedUser) {
    try {
      mockUser = JSON.parse(savedUser);
    } catch (e) {}
  }
  const savedDemands = localStorage.getItem('@siesal:demands');
  if (savedDemands) {
    try {
      mockDemands = JSON.parse(savedDemands);
    } catch (e) {}
  }
  const savedSubjects = localStorage.getItem('@siesal:subjects');
  if (savedSubjects) {
    try {
      mockSubjects = JSON.parse(savedSubjects);
    } catch (e) {}
  } else {
    // Matérias padrão limpas para início rápido
    mockSubjects = [
      { id_marcador: 1, nome: 'Português', cor: '#F97316' },
      { id_marcador: 2, nome: 'Matemática', cor: '#3B82F6' },
      { id_marcador: 3, nome: 'Ciências', cor: '#22C55E' },
      { id_marcador: 4, nome: 'História', cor: '#EAB308' },
      { id_marcador: 5, nome: 'Geografia', cor: '#06B6D4' },
      { id_marcador: 6, nome: 'Artes', cor: '#A855F7' },
      { id_marcador: 7, nome: 'Inglês', cor: '#EC4899' },
    ];
  }
  const savedEvents = localStorage.getItem('@siesal:events');
  if (savedEvents) {
    try {
      mockEvents = JSON.parse(savedEvents);
    } catch (e) {}
  }
  const savedNotifications = localStorage.getItem('@siesal:notifications');
  if (savedNotifications) {
    try {
      mockNotifications = JSON.parse(savedNotifications);
    } catch (e) {}
  }
};

initLocalState();

const saveLocalState = () => {
  if (mockUser) localStorage.setItem('@siesal:user', JSON.stringify(mockUser));
  localStorage.setItem('@siesal:demands', JSON.stringify(mockDemands));
  localStorage.setItem('@siesal:subjects', JSON.stringify(mockSubjects));
  localStorage.setItem('@siesal:events', JSON.stringify(mockEvents));
  localStorage.setItem('@siesal:notifications', JSON.stringify(mockNotifications));
};

const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem('@siesal:token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function customFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...((options.headers as Record<string, string>) || {}),
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Propaga campos extras do backend (bloqueado, tentativas_restantes, field)
      const error: any = new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      error.bloqueado = errorData.bloqueado || false;
      error.tentativas_restantes = errorData.tentativas_restantes;
      error.field = errorData.field;
      throw error;
    }

    return await response.json();
  } catch (err: any) {
    // Fallback limpo caso o servidor Express local ainda esteja iniciando
    return handleMockFallback<T>(endpoint, options, err);
  }
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// Registros mock para simular BD local (email → {senha hash simulado, userData})
type MockAccount = { senha: string; user: Usuario };
const getMockAccounts = (): Record<string, MockAccount> => {
  try {
    return JSON.parse(localStorage.getItem('@siesal:mock_accounts') || '{}');
  } catch { return {}; }
};
const saveMockAccounts = (accounts: Record<string, MockAccount>) => {
  localStorage.setItem('@siesal:mock_accounts', JSON.stringify(accounts));
};

function handleMockFallback<T>(endpoint: string, options: RequestInit, originalError: any): T {
  const method = options.method || 'GET';

  if (endpoint.startsWith('/auth/login')) {
    const body = JSON.parse(String(options.body));
    const { email, senha } = body;

    // Validações client-side no fallback
    if (!email || !email.trim()) {
      const err: any = new Error('E-mail é obrigatório.');
      err.field = 'email';
      throw err;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      const err: any = new Error('Formato de e-mail inválido. Ex: aluno@escola.com');
      err.field = 'email';
      throw err;
    }
    if (!senha || senha.length === 0) {
      const err: any = new Error('Senha é obrigatória.');
      err.field = 'senha';
      throw err;
    }

    const accounts = getMockAccounts();
    const emailKey = email.trim().toLowerCase();
    const account = accounts[emailKey];

    if (!account) {
      const err: any = new Error('E-mail ou senha incorretos. Verifique suas credenciais.');
      throw err;
    }

    // Simulação simples: compara senha em plain text no mock
    if (account.senha !== senha) {
      const err: any = new Error('E-mail ou senha incorretos. Verifique suas credenciais.');
      throw err;
    }

    mockUser = account.user;
    saveLocalState();
    return { token: 'mock-jwt-token-siesal-2026', usuario: account.user } as unknown as T;
  }

  if (endpoint.startsWith('/auth/register')) {
    const body = JSON.parse(String(options.body));
    const { nome, email, senha, escola, turma } = body;

    // Validações client-side no fallback
    if (!nome || nome.trim().length < 2) {
      const err: any = new Error('Nome completo deve ter pelo menos 2 caracteres.');
      err.field = 'nome';
      throw err;
    }
    if (!email || !email.trim()) {
      const err: any = new Error('E-mail é obrigatório.');
      err.field = 'email';
      throw err;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      const err: any = new Error('Formato de e-mail inválido. Ex: aluno@escola.com');
      err.field = 'email';
      throw err;
    }
    if (!senha || senha.length < 6) {
      const err: any = new Error('A senha deve ter pelo menos 6 caracteres.');
      err.field = 'senha';
      throw err;
    }
    if (!escola || escola.trim().length < 3) {
      const err: any = new Error('O nome da escola deve ter pelo menos 3 caracteres.');
      err.field = 'escola';
      throw err;
    }
    if (!turma || !turma.trim()) {
      const err: any = new Error('Turma/série é obrigatória.');
      err.field = 'turma';
      throw err;
    }

    const accounts = getMockAccounts();
    const emailKey = email.trim().toLowerCase();

    // Verifica duplicata de e-mail
    if (accounts[emailKey]) {
      const err: any = new Error('Este e-mail já está cadastrado. Faça login ou use outro endereço.');
      err.field = 'email';
      throw err;
    }

    const newUser: Usuario = {
      id_usuario: Date.now(),
      nome: nome.trim(),
      email: emailKey,
      escola: escola.trim(),
      turma: turma.trim(),
      data_cadastro: new Date().toISOString(),
      status: true,
    };

    // Salva conta mock com senha (para futuros logins offline)
    accounts[emailKey] = { senha, user: newUser };
    saveMockAccounts(accounts);
    mockUser = newUser;
    saveLocalState();
    return { token: 'mock-jwt-token-siesal-2026', usuario: newUser } as unknown as T;
  }

  if (endpoint.startsWith('/stats/dashboard')) {
    const stats: DashboardStats = {
      todosOsPrazos: {
        total: mockDemands.length,
        urgente: mockDemands.filter((d) => d.prioridade === 'Urgente' && d.status !== 'Concluido').length,
        proximo: mockDemands.filter((d) => d.prioridade === 'Proximo' && d.status !== 'Concluido').length,
        longe: mockDemands.filter((d) => (d.prioridade === 'Longe' || d.prioridade === 'Baixa') && d.status !== 'Concluido').length,
        concluido: mockDemands.filter((d) => d.status === 'Concluido').length,
      },
      essaSemana: {
        total: mockDemands.length,
        urgente: mockDemands.filter((d) => d.prioridade === 'Urgente' && d.status !== 'Concluido').length,
        proximo: mockDemands.filter((d) => d.prioridade === 'Proximo' && d.status !== 'Concluido').length,
        longe: mockDemands.filter((d) => (d.prioridade === 'Longe' || d.prioridade === 'Baixa') && d.status !== 'Concluido').length,
        concluido: mockDemands.filter((d) => d.status === 'Concluido').length,
      },
      distribuicaoMaterias: mockSubjects.map((s) => ({
        id_marcador: s.id_marcador,
        nome: s.nome,
        cor: s.cor,
        total: mockDemands.filter((d) => d.id_marcador === s.id_marcador).length,
        pendentes: mockDemands.filter((d) => d.id_marcador === s.id_marcador && d.status !== 'Concluido').length,
        concluidas: mockDemands.filter((d) => d.id_marcador === s.id_marcador && d.status === 'Concluido').length,
      })),
      avisos: mockNotifications,
    };
    return stats as unknown as T;
  }

  if (endpoint.startsWith('/demands')) {
    if (method === 'GET') {
      return mockDemands.map((d) => ({
        ...d,
        prioridade: calculateDynamicPriority(d.data_entrega, d.dificuldade || 'Médio'),
      })) as unknown as T;
    }
    if (method === 'POST') {
      const body = JSON.parse(String(options.body));
      const dynamicPriority = calculateDynamicPriority(body.data_entrega, body.dificuldade || 'Médio');
      const newDemand: Tarefa = {
        id_tarefa: Date.now(),
        titulo: body.titulo,
        descricao: body.descricao || '',
        data_criacao: new Date().toISOString(),
        data_entrega: body.data_entrega,
        prioridade: dynamicPriority,
        status: body.status || 'Pendente',
        dificuldade: body.dificuldade || 'Médio',
        tipo: body.tipo || 'Atividade',
        professor: body.professor || '',
        id_usuario: mockUser?.id_usuario || 1,
        id_marcador: body.id_marcador ? Number(body.id_marcador) : null,
        marcador: mockSubjects.find((s) => s.id_marcador === Number(body.id_marcador)) || null,
      };
      mockDemands = [newDemand, ...mockDemands];
      saveLocalState();
      return newDemand as unknown as T;
    }
    if (endpoint.includes('/toggle')) {
      const id = Number(endpoint.split('/')[2]);
      const item = mockDemands.find((d) => d.id_tarefa === id);
      if (item) {
        item.status = item.status === 'Concluido' ? 'Pendente' : 'Concluido';
        saveLocalState();
        return item as unknown as T;
      }
    }
    if (method === 'DELETE') {
      const id = Number(endpoint.split('/')[2]);
      mockDemands = mockDemands.filter((d) => d.id_tarefa !== id);
      saveLocalState();
      return { message: 'Deletado' } as unknown as T;
    }
  }

  if (endpoint.startsWith('/subjects')) {
    if (method === 'GET') {
      return mockSubjects as unknown as T;
    }
    if (method === 'POST') {
      const body = JSON.parse(String(options.body));
      const newSubject: Marcador = {
        id_marcador: Date.now(),
        nome: body.nome,
        cor: body.cor,
        id_usuario: mockUser?.id_usuario || 1,
      };
      mockSubjects = [...mockSubjects, newSubject];
      saveLocalState();
      return newSubject as unknown as T;
    }
    if (method === 'DELETE') {
      const id = Number(endpoint.split('/')[2]);
      mockSubjects = mockSubjects.filter((s) => s.id_marcador !== id);
      saveLocalState();
      return { message: 'Deletado' } as unknown as T;
    }
  }

  if (endpoint.startsWith('/events')) {
    if (method === 'GET') {
      return mockEvents as unknown as T;
    }
    if (method === 'POST') {
      const body = JSON.parse(String(options.body));
      const newEvent: Evento = {
        id_evento: Date.now(),
        titulo: body.titulo,
        descricao: body.descricao || '',
        data_inicio: body.data_inicio,
        data_fim: body.data_fim,
        local: body.local || '',
        id_usuario: mockUser?.id_usuario || 1,
      };
      mockEvents = [...mockEvents, newEvent];
      saveLocalState();
      return newEvent as unknown as T;
    }
    if (method === 'DELETE') {
      const id = Number(endpoint.split('/')[2]);
      mockEvents = mockEvents.filter((e) => e.id_evento !== id);
      saveLocalState();
      return { message: 'Deletado' } as unknown as T;
    }
  }

  if (endpoint.startsWith('/notifications')) {
    if (endpoint.includes('/read-all')) {
      mockNotifications = mockNotifications.map((n) => ({ ...n, lida: true }));
      saveLocalState();
      return { message: 'Todas lidas' } as unknown as T;
    }
    if (endpoint.includes('/read')) {
      const id = Number(endpoint.split('/')[2]);
      const notif = mockNotifications.find((n) => n.id_notificacao === id);
      if (notif) notif.lida = true;
      saveLocalState();
      return notif as unknown as T;
    }
    return mockNotifications as unknown as T;
  }

  if (endpoint.startsWith('/auth/profile')) {
    return (mockUser || {
      id_usuario: 1,
      nome: 'Estudante',
      email: 'aluno@escola.gov.br',
    }) as unknown as T;
  }

  throw originalError;
}

export const api = {
  // Autenticação
  login: (data: any) => customFetch<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: any) => customFetch<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getProfile: () => customFetch<Usuario>('/auth/profile'),

  // Demandas
  getDemands: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return customFetch<Tarefa[]>(`/demands${query}`);
  },
  getDemandById: (id: number) => customFetch<Tarefa>(`/demands/${id}`),
  createDemand: (data: Partial<Tarefa> & { criar_lembrete?: boolean }) =>
    customFetch<Tarefa>('/demands', { method: 'POST', body: JSON.stringify(data) }),
  updateDemand: (id: number, data: Partial<Tarefa>) =>
    customFetch<Tarefa>(`/demands/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleDemandStatus: (id: number) =>
    customFetch<Tarefa>(`/demands/${id}/toggle`, { method: 'PATCH' }),
  deleteDemand: (id: number) =>
    customFetch<{ message: string }>(`/demands/${id}`, { method: 'DELETE' }),

  // Matérias / Marcadores
  getSubjects: () => customFetch<Marcador[]>('/subjects'),
  createSubject: (data: { nome: string; cor: string }) =>
    customFetch<Marcador>('/subjects', { method: 'POST', body: JSON.stringify(data) }),
  updateSubject: (id: number, data: { nome?: string; cor?: string }) =>
    customFetch<Marcador>(`/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSubject: (id: number) =>
    customFetch<{ message: string }>(`/subjects/${id}`, { method: 'DELETE' }),

  // Eventos e Agenda
  getEvents: (params?: { month?: number; year?: number; date?: string }) => {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return customFetch<Evento[]>(`/events${query}`);
  },
  createEvent: (data: Partial<Evento>) =>
    customFetch<Evento>('/events', { method: 'POST', body: JSON.stringify(data) }),
  deleteEvent: (id: number) =>
    customFetch<{ message: string }>(`/events/${id}`, { method: 'DELETE' }),

  // Notificações e Avisos
  getNotifications: () => customFetch<Notificacao[]>('/notifications'),
  markNotificationAsRead: (id: number) =>
    customFetch<Notificacao>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsAsRead: () =>
    customFetch<{ message: string }>('/notifications/read-all', { method: 'POST' }),

  // Dashboard Stats
  getDashboardStats: () => customFetch<DashboardStats>('/stats/dashboard'),

  // Limpeza de dados
  clearAllData: () => {
    mockDemands = [];
    mockEvents = [];
    mockNotifications = [];
    localStorage.removeItem('@siesal:demands');
    localStorage.removeItem('@siesal:events');
    localStorage.removeItem('@siesal:notifications');
  }
};
