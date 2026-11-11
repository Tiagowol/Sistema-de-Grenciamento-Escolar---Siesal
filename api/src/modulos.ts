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
