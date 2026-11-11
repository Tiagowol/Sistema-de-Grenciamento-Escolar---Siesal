import type { Identidade } from './api';
import {
  CONTRASTE_MINIMO,
  FUNDO_DO_TEMA,
  razaoDeContraste,
  TEXTO_SOBRE_DESTAQUE,
  type Tema,
} from './paleta';

// Identidade visual da escola (L19). Mesma regra de contraste da API: a cor do tema claro vale também contra o
// alto contraste; a do escuro, contra o tema escuro. Cada uma precisa de 4,5:1 contra o fundo e contra o texto.
export function corDaEscolaLegivel(cor: string, tema: 'claro' | 'escuro'): boolean {
  const temas = tema === 'claro' ? (['claro', 'alto_contraste'] as const) : (['escuro'] as const);
  return temas.every(
    (t) =>
      razaoDeContraste(cor, FUNDO_DO_TEMA[t]) >= CONTRASTE_MINIMO &&
      razaoDeContraste(cor, TEXTO_SOBRE_DESTAQUE[t]) >= CONTRASTE_MINIMO,
  );
}

// Cor da escola para o tema atual. No alto contraste a escola não muda a cor: vale o tema escolhido pela pessoa.
export function corDaEscola(i: Identidade | null, tema: Tema): string | null {
  if (!i || tema === 'alto_contraste') return null;
  const cor = tema === 'claro' ? i.cor_claro : i.cor_escuro;
  return cor && corDaEscolaLegivel(cor, tema) ? cor : null;
}
