// Quem pode administrar usuários da própria instituição. Espelha a matriz (recurso "usuarios", ação "administrar");
// o teste em verificacao/politica-coerente.test.ts garante que as duas não se separem.
export const PERFIS_CADASTRAVEIS = [
  'admin',
  'professor',
  'aluno',
  'pedagogico',
  'responsavel',
] as const;
export type PerfilCadastravel = (typeof PERFIS_CADASTRAVEIS)[number];

export function podeAdministrarUsuarios(perfil: string): boolean {
  return perfil === 'admin';
}

// Quem usa o Núcleo (tarefas, plano, agenda, notas pessoais): só o aluno, nos próprios dados.
// Espelha a matriz (tarefas/plano_regressivo/notas_pessoais, ação "administrar", escopo "proprio").
export function podeUsarNucleo(perfil: string): boolean {
  return perfil === 'aluno';
}

// Quem administra turmas, disciplinas e vínculos da própria instituição.
// Espelha a matriz v3 (recursos turmas, disciplinas e vinculos, ação "administrar").
export function podeAdministrarTurmas(perfil: string): boolean {
  return perfil === 'admin';
}

// Notas oficiais (L15). Espelham a matriz v4; o teste em verificacao/politica-coerente.test.ts garante a coerência.
export const podeLancarNota = (perfil: string): boolean => perfil === 'professor'; // lancar e revisar
export const podeLerNotas = (perfil: string): boolean =>
  ['admin', 'professor', 'aluno', 'pedagogico', 'responsavel'].includes(perfil);
export const podeVerHistoricoNotas = (perfil: string): boolean =>
  perfil === 'admin' || perfil === 'professor';
export const PERFIS_QUE_PEDEM_REVISAO = ['admin', 'aluno', 'pedagogico', 'responsavel'] as const;
export const podePedirRevisao = (perfil: string): boolean =>
  (PERFIS_QUE_PEDEM_REVISAO as readonly string[]).includes(perfil);
export const podeResponderPedido = (perfil: string): boolean => perfil === 'professor';
