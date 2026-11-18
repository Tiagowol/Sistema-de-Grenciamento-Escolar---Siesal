// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Login } from './paginas/Login';

// L22i (item 2): "Solicitar convite" para quem não tem código. Dados fictícios.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function abrirPedido() {
  const u = userEvent.setup();
  render(<Login instituicaoPadrao={null} aoEntrar={() => undefined} />);
  await u.click(screen.getByRole('radio', { name: 'Sem instituição' }));
  await u.click(screen.getByRole('button', { name: 'Criar conta' }));
  await u.click(screen.getByRole('button', { name: 'Não tenho código: solicitar convite' }));
  return u;
}

describe('Solicitar convite', () => {
  it('valida na tela e não envia com campo vazio ou link no motivo', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const u = await abrirPedido();
    await u.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    expect(await screen.findByText('Preencha o nome, o e-mail e o motivo.')).toBeTruthy();
    await u.type(screen.getByLabelText('Seu nome'), 'Ana');
    await u.type(screen.getByLabelText('E-mail'), 'ana@x.exemplo');
    await u.type(screen.getByLabelText('Motivo'), 'veja https://golpe.test');
    await u.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    expect(await screen.findByText('Não coloque links no motivo.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envia nome, e-mail e motivo e avisa que nenhuma conta foi criada; passa no axe', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 202,
      json: async () => ({ recebido: true, mensagem: 'Pedido recebido.' }),
      text: async () => '{"recebido":true,"mensagem":"Pedido recebido."}',
    }));
    vi.stubGlobal('fetch', fetchMock);
    const u = await abrirPedido();
    await u.type(screen.getByLabelText('Seu nome'), 'Ana');
    await u.type(screen.getByLabelText('E-mail'), 'ana@x.exemplo');
    await u.type(screen.getByLabelText('Motivo'), 'Quero estudar com o SIESAL.');
    await u.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    expect(await screen.findByText(/Nenhuma conta foi criada ainda/)).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/auth/solicitar-convite');
    expect(JSON.parse(String(init.body))).toEqual({
      nome: 'Ana',
      email: 'ana@x.exemplo',
      motivo: 'Quero estudar com o SIESAL.',
    });
    const r = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations).toEqual([]);
  });
});
