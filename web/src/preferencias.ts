// Preferências de acessibilidade (iguais às do protótipo). Guardadas no navegador; sem diagnóstico.
export type Preferencias = {
  escuro: boolean;
  contraste: boolean;
  movimento: boolean; // true = reduzir movimento
  legivel: boolean;
  simples: boolean;
  fonte: number; // 90 a 150 (%)
  tempoVisual: boolean; // true = tempo com palavra, data e forma (padrão: ligado)
};

export const PREFERENCIAS_PADRAO: Preferencias = {
  escuro: false,
  contraste: false,
  movimento: false,
  legivel: false,
  simples: false,
  fonte: 100,
  tempoVisual: true,
};

const CHAVE = 'siesal-preferencias-v1';

export function carregarPreferencias(
  armazem: Pick<Storage, 'getItem'> = localStorage,
): Preferencias {
  try {
    const bruto = JSON.parse(armazem.getItem(CHAVE) ?? 'null') as Partial<Preferencias> | null;
    const fonte = Number(bruto?.fonte);
    return {
      tempoVisual: bruto?.tempoVisual !== false,
      escuro: bruto?.escuro === true,
      contraste: bruto?.contraste === true,
      movimento: bruto?.movimento === true,
      legivel: bruto?.legivel === true,
      simples: bruto?.simples === true,
      fonte: Number.isFinite(fonte)
        ? Math.min(150, Math.max(90, Math.round(fonte / 10) * 10))
        : 100,
    };
  } catch {
    return { ...PREFERENCIAS_PADRAO };
  }
}

export function salvarPreferencias(
  p: Preferencias,
  armazem: Pick<Storage, 'setItem'> = localStorage,
): void {
  try {
    armazem.setItem(CHAVE, JSON.stringify(p));
  } catch {
    // Armazenamento bloqueado: a preferência vale só nesta visita
  }
}

// Liga e desliga as classes do CSS do protótipo e a escala da fonte
export function aplicarPreferencias(p: Preferencias, doc: Document = document): void {
  const c = doc.body.classList;
  c.toggle('dark', p.escuro);
  c.toggle('high-contrast', p.contraste);
  c.toggle('no-motion', p.movimento);
  c.toggle('readable', p.legivel);
  c.toggle('simple', p.simples);
  doc.documentElement.style.setProperty('--scale', String(p.fonte / 100));
}
