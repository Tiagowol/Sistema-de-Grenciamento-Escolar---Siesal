export interface Usuario {
  id_usuario: number;
  nome: string;
  email: string;
  escola?: string | null;
  turma?: string | null;
  data_cadastro?: string;
  status?: boolean;
}

export interface Marcador {
  id_marcador: number;
  nome: string;
  cor: string;
  id_usuario?: number;
  _count?: {
    tarefas: number;
  };
}

export type PrioridadeType = 'Urgente' | 'Proximo' | 'Longe' | 'Alta' | 'Média' | 'Baixa';
export type StatusType = 'Pendente' | 'Concluido' | 'No prazo' | 'Atrasado';
export type DificuldadeType = 'Fácil' | 'Médio' | 'Difícil';
export type TipoDemandaType = 'Atividade' | 'Trabalho' | 'Prova' | 'Exercício';

export interface Tarefa {
  id_tarefa: number;
  titulo: string;
  descricao?: string | null;
  data_criacao: string;
  data_entrega: string;
  prioridade: PrioridadeType;
  status: StatusType;
  dificuldade?: DificuldadeType | null;
  tipo?: TipoDemandaType | null;
  professor?: string | null;
  id_usuario: number;
  id_marcador?: number | null;
  marcador?: Marcador | null;
  lembretes?: Lembrete[];
}

export interface Evento {
  id_evento: number;
  titulo: string;
  descricao?: string | null;
  data_inicio: string;
  data_fim: string;
  local?: string | null;
  id_usuario: number;
}

export interface Lembrete {
  id_lembrete: number;
  mensagem: string;
  data_hora: string;
  data_envio?: string | null;
  enviado: boolean;
  id_usuario: number;
  id_tarefa?: number | null;
  id_evento?: number | null;
}

export interface Notificacao {
  id_notificacao: number;
  titulo: string;
  mensagem: string;
  data_envio: string;
  lida: boolean;
  id_usuario: number;
}

export interface StatsGroup {
  total: number;
  urgente: number;
  proximo: number;
  longe: number;
  concluido: number;
}

export interface SubjectDistribution {
  id_marcador: number;
  nome: string;
  cor: string;
  total: number;
  pendentes: number;
  concluidas: number;
}

export interface DashboardStats {
  todosOsPrazos: StatsGroup;
  essaSemana: StatsGroup;
  distribuicaoMaterias: SubjectDistribution[];
  avisos: Notificacao[];
}
