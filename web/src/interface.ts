import type { InterfaceServidor } from './api';

// Preferências de interface (L17d). Com sessão, valem as do banco (por usuário).
// Uma cópia fica neste aparelho para a tela de entrada, que ainda não sabe quem é a pessoa.
export type Interface = InterfaceServidor;

export const INTERFACE_PADRAO: Interface = {
  rotulos: 'icones',
  vlibras: true,
  vlibras_aviso_aceito: false,
};

const CHAVE = 'siesal-interface-v1';

export function carregarInterface(armazem: Pick<Storage, 'getItem'> = localStorage): Interface {
  try {
    const b = JSON.parse(armazem.getItem(CHAVE) ?? 'null') as Partial<Interface> | null;
    return {
      rotulos: b?.rotulos === 'texto' ? 'texto' : 'icones',
      vlibras: b?.vlibras !== false,
      vlibras_aviso_aceito: b?.vlibras_aviso_aceito === true,
    };
  } catch {
    return { ...INTERFACE_PADRAO };
  }
}

export function salvarInterface(
  p: Interface,
  armazem: Pick<Storage, 'setItem'> = localStorage,
): void {
  try {
    armazem.setItem(CHAVE, JSON.stringify(p));
  } catch {
    // Armazenamento bloqueado: vale só nesta visita
  }
}
