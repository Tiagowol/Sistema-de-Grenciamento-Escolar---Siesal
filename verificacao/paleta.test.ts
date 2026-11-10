import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CONTRASTE_MINIMO,
  CORES,
  combinacaoLegivel,
  FUNDO_DO_TEMA,
  razaoDeContraste,
  TEMAS,
  TEXTO_SOBRE_DESTAQUE,
} from '../shared/src/paleta.js';

// L17b: a paleta existe em 3 lugares (shared, api, web) e precisa ser a mesma; toda cor precisa ser legível.
const ler = (caminho: string) =>
  readFileSync(new URL(caminho, import.meta.url), 'utf-8').replace(/\r\n/g, '\n');

describe('paleta de destaque', () => {
  it('as 3 cópias do arquivo são iguais', () => {
    const base = ler('../shared/src/paleta.ts');
    expect(ler('../api/src/nucleo/paleta.ts')).toBe(base);
    expect(ler('../web/src/paleta.ts')).toBe(base);
  });

  it.each(TEMAS)('toda cor da paleta passa no contraste mínimo no tema %s', (tema) => {
    for (const cor of CORES) {
      expect(
        razaoDeContraste(cor[tema], FUNDO_DO_TEMA[tema]),
        `${cor.id} no fundo`,
      ).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
      expect(
        razaoDeContraste(cor[tema], TEXTO_SOBRE_DESTAQUE[tema]),
        `${cor.id} com o texto do botão`,
      ).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
      expect(combinacaoLegivel(cor.id, tema)).toBe(true);
    }
  });

  it('cor desconhecida e combinação ilegível são recusadas', () => {
    expect(combinacaoLegivel('amarelo', 'claro')).toBe(false);
    expect(razaoDeContraste('#ffffff', '#ffff00')).toBeLessThan(CONTRASTE_MINIMO);
    expect(razaoDeContraste('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });
});
