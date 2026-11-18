// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AVISO_CODIGO_INVALIDO, codigoTemCaractereInvalido } from './codigoConvite';
import { Login } from './paginas/Login';

// L22h (F-060): código de convite com 0, 1, I ou O é avisado na tela, sem chamar o servidor.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('codigoTemCaractereInvalido', () => {
  it('acusa 0, 1, I e O, em maiúscula ou minúscula, com ou sem traços', () => {
    for (const c of [
      'sncd-dvfg-jyuu-idvn',
      'ABCD-EFGH-JKLM-NPQ0',
      'abcd efgh jklm npq1',
      'ABCDEFGHJKLMNPQO',
    ])
      expect(codigoTemCaractereInvalido(c), c).toBe(true);
  });
  it('aceita um código no alfabeto dos convites', () => {
    expect(codigoTemCaractereInvalido('ABCD-EFGH-JKLM-NPQR')).toBe(false);
    expect(codigoTemCaractereInvalido('abcd-efgh-jklm-npqr')).toBe(false);
    expect(codigoTemCaractereInvalido('2345-6789-ABCD-EFGH')).toBe(false);
  });
});

describe('criar conta sem instituição com código inválido', () => {
  it('mostra o aviso e não envia nada ao servidor', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<Login instituicaoPadrao={null} aoEntrar={() => undefined} />);
    const u = userEvent.setup();
    await u.click(screen.getByRole('radio', { name: 'Sem instituição' }));
    await u.click(screen.getByRole('button', { name: 'Criar conta' }));
    await u.type(screen.getByLabelText('Código do convite'), 'sncd-dvfg-jyuu-idvn');
    await u.type(screen.getByLabelText('Seu nome'), 'Ana');
    await u.type(screen.getByLabelText('Data de nascimento'), '2000-01-15');
    await u.type(screen.getByLabelText('E-mail'), 'ana@x.exemplo');
    await u.type(screen.getByLabelText('Senha'), 'uma senha bem longa 1');
    await u.click(
      screen
        .getAllByRole('button', { name: 'Criar conta' })
        .find((b) => (b as HTMLButtonElement).type === 'submit') as HTMLElement,
    );
    expect(await screen.findByText(AVISO_CODIGO_INVALIDO)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
