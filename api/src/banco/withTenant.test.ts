import { describe, expect, it, vi } from 'vitest';
import { withTenant } from './withTenant.js';

describe('withTenant (contexto inválido)', () => {
  it('rejeita instituição que não é UUID sem abrir transação', async () => {
    const abrirTransacao = vi.fn();
    const banco = { $transaction: abrirTransacao } as never;

    await expect(
      withTenant(banco, { instituicaoId: "x'; DROP TABLE usuario;--" }, async () => 1),
    ).rejects.toThrow();
    await expect(withTenant(banco, { instituicaoId: '' }, async () => 1)).rejects.toThrow();
    expect(abrirTransacao).not.toHaveBeenCalled();
  });
});
