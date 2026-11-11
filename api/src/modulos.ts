import type { ClienteTransacao } from './banco/withTenant.js';

// Módulos que o Master liga e desliga por instituição (L20). Sem linha no banco = ligado.
export const MODULOS = ['mensagens', 'calendario', 'apoio_aluno'] as const;
export type Modulo = (typeof MODULOS)[number];
export type EstadoModulos = Record<Modulo, boolean>;

// Rotas da API de cada módulo. Módulo desligado = estas rotas respondem 403 (não basta esconder do menu).
// A Agenda (/eventos) é do núcleo e continua; sem o calendário, ela só deixa de trazer os itens da escola.
const PREFIXOS: Record<Modulo, string[]> = {
  mensagens: ['/caixa', '/avisos-escolares'],
  calendario: ['/escola/calendario'],
  apoio_aluno: ['/ajuda'],
};

export function moduloDaRota(url: string): Modulo | null {
  const caminho = url.split('?')[0] ?? '';
  for (const m of MODULOS)
    if (PREFIXOS[m].some((p) => caminho === p || caminho.startsWith(`${p}/`))) return m;
  return null;
}

// Estado dos módulos da instituição do contexto (withTenant)
export async function lerModulos(tx: ClienteTransacao): Promise<EstadoModulos> {
  const linhas = await tx.$queryRaw<{ modulo: Modulo; ligado: boolean }[]>`
    SELECT modulo, ligado FROM instituicao_modulo`;
  const estado: EstadoModulos = { mensagens: true, calendario: true, apoio_aluno: true };
  for (const l of linhas) estado[l.modulo] = l.ligado;
  return estado;
}

// ---------- Espaço individual (20c-1) ----------
// Aluno sem instituição: um espaço só dele. Deny by default: só estas rotas existem lá. Não há turmas, notas oficiais,
// avisos, caixa de mensagens, calendário nem identidade da escola, pedido de ajuda ao professor nem suporte.
export type TipoDeEspaco = 'escola' | 'individual';
const PREFIXOS_DO_ESPACO_INDIVIDUAL = [
  '/auth',
  '/preferencias',
  '/tipos-atividade',
  '/tarefas',
  '/microetapas',
  '/eventos',
  '/sessoes',
  '/notas-pessoais',
  '/minhas-disciplinas',
  '/meu-dia',
  '/notificacoes',
  '/conta',
];
export function rotaDoEspacoIndividual(url: string): boolean {
  const caminho = url.split('?')[0] ?? '';
  return PREFIXOS_DO_ESPACO_INDIVIDUAL.some((p) => caminho === p || caminho.startsWith(`${p}/`));
}

// Tipo da instituição do contexto (withTenant)
export async function lerTipoDeEspaco(tx: ClienteTransacao): Promise<TipoDeEspaco> {
  const [i] = await tx.$queryRaw<{ tipo: TipoDeEspaco }[]>`SELECT tipo FROM instituicao LIMIT 1`;
  return i?.tipo === 'individual' ? 'individual' : 'escola';
}

// No espaço individual, o que é da escola fica desligado; o calendário pessoal continua
export const MODULOS_DO_ESPACO_INDIVIDUAL: EstadoModulos = {
  mensagens: false,
  calendario: true,
  apoio_aluno: false,
};
