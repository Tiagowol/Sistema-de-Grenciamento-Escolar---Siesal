// Os 6 perfis da Parte 1 (Documento de Visão, seção 3). "master" fica fora do modelo escolar.
export const PERFIS = [
  'master',
  'admin',
  'professor',
  'aluno',
  'pedagogico',
  'responsavel',
] as const;

export type Perfil = (typeof PERFIS)[number];

// Perfis que pertencem a uma instituição (todos, menos o master)
export const PERFIS_ESCOLARES: readonly Perfil[] = PERFIS.filter((p) => p !== 'master');
