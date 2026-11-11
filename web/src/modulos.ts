import type { EstadoModulos, Modulo } from './api';

// Módulos da escola nesta sessão (L20). O App define depois do login; sem informação, tudo ligado.
let atuais: EstadoModulos | null = null;
export function definirModulos(m: EstadoModulos | null | undefined): void {
  atuais = m ?? null;
}
export const moduloLigado = (m: Modulo): boolean => atuais?.[m] ?? true;
