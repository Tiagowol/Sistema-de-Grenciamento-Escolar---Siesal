import type { Evento } from './api';

// Nomes em português dos tipos e das origens de evento (Agenda e Calendário usam os mesmos)
type TipoDoAluno = Exclude<Evento['tipo'], 'periodo_letivo' | 'feriado' | 'evento_escolar'>;
export const NOMES_TIPO: Record<TipoDoAluno, string> = {
  aula: 'Aula',
  estudo: 'Estudo',
  pessoal: 'Pessoal',
  prova: 'Prova',
  trabalho: 'Trabalho',
  lembrete: 'Lembrete',
  compromisso: 'Compromisso',
};
// Tipos que só chegam do calendário da escola (L19)
const NOMES_TIPO_ESCOLA: Record<Exclude<Evento['tipo'], TipoDoAluno>, string> = {
  periodo_letivo: 'Período letivo',
  feriado: 'Feriado',
  evento_escolar: 'Evento da escola',
};
export const nomeDoTipo = (t: Evento['tipo']): string =>
  (NOMES_TIPO as Record<string, string>)[t] ??
  (NOMES_TIPO_ESCOLA as Record<string, string>)[t] ??
  t;

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
