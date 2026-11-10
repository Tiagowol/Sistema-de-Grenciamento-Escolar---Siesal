import type { PreferenciasServidor } from './api';
import { combinacaoLegivel, type Tema, valorDaCor } from './paleta';

// Preferências de acessibilidade (iguais às do protótipo). Guardadas no navegador; sem diagnóstico.
export type Preferencias = {
  escuro: boolean;
  contraste: boolean;
  movimento: boolean; // true = reduzir movimento
  legivel: boolean;
  simples: boolean;
  fonte: number; // 90 a 150 (%)
  tempoVisual: boolean; // true = tempo com palavra, data e forma (padrão: ligado)
  linguagemCurta: boolean; // true = frases curtas nas telas do aluno (padrão: desligado)
  escolhaAgora: boolean; // true = cartão "Escolha o que fazer agora" no Meu dia (padrão: ligado)
  apelido: string | null; // nome de exibição (L17b); sem apelido, vale o primeiro nome
  cor: string | null; // cor de destaque (id da paleta); sem cor, vale a do tema
  telaInicial: 'meudia' | 'agenda' | 'calendario'; // tela que abre depois do login
};

export const PREFERENCIAS_PADRAO: Preferencias = {
  escuro: false,
  contraste: false,
  movimento: false,
  legivel: false,
  simples: false,
  fonte: 100,
  tempoVisual: true,
  linguagemCurta: false,
  escolhaAgora: true,
  apelido: null,
  cor: null,
  telaInicial: 'meudia',
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
      linguagemCurta: bruto?.linguagemCurta === true,
      escolhaAgora: bruto?.escolhaAgora !== false,
      apelido: typeof bruto?.apelido === 'string' && bruto.apelido.trim() ? bruto.apelido : null,
      cor: typeof bruto?.cor === 'string' ? bruto.cor : null,
      telaInicial:
        bruto?.telaInicial === 'agenda' || bruto?.telaInicial === 'calendario'
          ? bruto.telaInicial
          : 'meudia',
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
  // Cor de destaque (L17b): só se passar no contraste do tema; senão volta a cor do tema
  const valor = corValida(p) ? valorDaCor(p.cor as string, temaDe(p)) : null;
  if (valor) doc.body.style.setProperty('--primary', valor);
  else doc.body.style.removeProperty('--primary');
}

// Tema que as chaves "escuro" e "contraste" formam (alto contraste vence o escuro)
export const temaDe = (p: Pick<Preferencias, 'escuro' | 'contraste'>): Tema =>
  p.contraste ? 'alto_contraste' : p.escuro ? 'escuro' : 'claro';

// Cor de destaque que de fato vale: só se for legível no tema atual
export const corValida = (p: Preferencias): string | null =>
  p.cor && combinacaoLegivel(p.cor, temaDe(p)) ? p.cor : null;

// Conversões entre o que fica no aparelho e o que fica no banco (por usuário)
export function doServidor(s: PreferenciasServidor): Preferencias {
  return {
    escuro: s.tema === 'escuro',
    contraste: s.tema === 'alto_contraste',
    movimento: s.reduzir_movimento,
    legivel: s.leitura_facilitada,
    simples: s.modo_simples,
    fonte: s.fonte,
    tempoVisual: s.tempo_visual,
    linguagemCurta: s.linguagem_curta,
    escolhaAgora: s.escolha_agora,
    apelido: s.apelido,
    cor: s.cor_destaque,
    telaInicial: s.tela_inicial,
  };
}
export function paraServidor(p: Preferencias): PreferenciasServidor {
  return {
    apelido: p.apelido,
    cor_destaque: corValida(p),
    tema: temaDe(p),
    fonte: p.fonte,
    reduzir_movimento: p.movimento,
    leitura_facilitada: p.legivel,
    modo_simples: p.simples,
    tempo_visual: p.tempoVisual,
    linguagem_curta: p.linguagemCurta,
    escolha_agora: p.escolhaAgora,
    tela_inicial: p.telaInicial,
  };
}
