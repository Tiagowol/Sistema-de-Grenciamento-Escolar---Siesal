import type { Evento } from './api';

// Nomes em português dos tipos e das origens de evento (Agenda e Calendário usam os mesmos)
export const NOMES_TIPO: Record<Evento['tipo'], string> = {
  aula: 'Aula',
  estudo: 'Estudo',
  pessoal: 'Pessoal',
  prova: 'Prova',
  trabalho: 'Trabalho',
  lembrete: 'Lembrete',
  compromisso: 'Compromisso',
};

// Selo da origem: só aparece para evento que não nasceu no calendário do aluno
export const SELO_ORIGEM: Partial<Record<Evento['origem'], string>> = {
  plano: 'do seu plano',
  google_agenda: 'do Google Agenda',
  google_sala_de_aula: 'do Google Sala de Aula',
  calendario_escolar: 'do calendário da escola',
};

// O aluno só edita evento criado por ele; os demais ele só oculta
export const podeEditar = (e: Pick<Evento, 'origem'>): boolean => e.origem === 'manual';
export const podeRemover = (e: Pick<Evento, 'origem'>): boolean =>
  e.origem === 'manual' || e.origem === 'plano';
