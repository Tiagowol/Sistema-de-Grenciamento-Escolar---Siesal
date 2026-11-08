import { describe, expect, it } from 'vitest';
import { mascarar } from './auditoria.js';

describe('mascarar', () => {
  it('troca campos sensíveis em qualquer nível', () => {
    const entrada = {
      nome: 'Ana',
      senha: 'x',
      dados: { token_sessao: 'y', lista: [{ codigo_recuperacao: 'z', ok: 1 }] },
    };
    expect(mascarar(entrada)).toEqual({
      nome: 'Ana',
      senha: '***',
      dados: { token_sessao: '***', lista: [{ codigo_recuperacao: '***', ok: 1 }] },
    });
  });

  it('não devolve nada quando não há valor', () => {
    expect(mascarar(undefined)).toBeUndefined();
    expect(mascarar(null)).toBeUndefined();
  });
});
