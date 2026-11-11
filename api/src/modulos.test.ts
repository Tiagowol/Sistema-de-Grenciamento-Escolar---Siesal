import { describe, expect, it } from 'vitest';
import { moduloDaRota } from './modulos.js';

// L20: cada rota de módulo é reconhecida; o resto do sistema não é afetado
describe('moduloDaRota', () => {
  it('reconhece as rotas dos 3 módulos, com ou sem parâmetros', () => {
    expect(moduloDaRota('/caixa')).toBe('mensagens');
    expect(moduloDaRota('/caixa/vistos')).toBe('mensagens');
    expect(moduloDaRota('/avisos-escolares/turmas')).toBe('mensagens');
    expect(moduloDaRota('/escola/calendario?de=2026-01-01&ate=2026-12-31')).toBe('calendario');
    expect(moduloDaRota('/escola/calendario/abc/ocultar')).toBe('calendario');
    expect(moduloDaRota('/ajuda/destinos')).toBe('apoio_aluno');
  });

  it('não confunde rotas parecidas nem do núcleo', () => {
    for (const url of [
      '/eventos',
      '/escola/identidade',
      '/escola/regras-notas',
      '/caixas',
      '/ajudas',
      '/auth/eu',
    ])
      expect(moduloDaRota(url), url).toBeNull();
  });
});
