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
