// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PedidoConvite } from './api';
import { PedidosConvite } from './paginas/PedidosConvite';

// L22i (item 3): fila de pedidos de convite (Master e Admin indicado). Dados fictícios.
afterEach(() => {
  cleanup();
});

const hoje = new Date().toISOString();
const PEDIDOS: PedidoConvite[] = [
  {
    pedido_id: 'p1',
    nome: 'Ana Ficticia',
    email: 'ana@x.exemplo',
    motivo: 'Quero estudar com o SIESAL.',
    criado_em: hoje,
  },
  {
    pedido_id: 'p2',
    nome: 'Bia Ficticia',
    email: 'bia@x.exemplo',
    motivo: 'Preciso de ajuda com as tarefas.',
    criado_em: hoje,
  },
];

function montar() {
  let fila = [...PEDIDOS];
  const decidir = vi.fn(async (p: PedidoConvite, acao: 'aprovar' | 'recusar') => {
    fila = fila.filter((x) => x.pedido_id !== p.pedido_id);
    // L22j: aprovar devolve o código para a tela
    return acao === 'aprovar'
      ? { codigo: 'ABCD-EFGH-JKLM-NPQR', expira_em: '2026-11-25T12:00:00Z' }
      : undefined;
  });
  const carregar = vi.fn(async () => fila);
  const r = render(<PedidosConvite nivel="h1" carregar={carregar} decidir={decidir} />);
  return { ...r, decidir };
}

describe('Pedidos de convite', () => {
  it('lista nome, e-mail e motivo; passa no axe', async () => {
    const { container } = montar();
    expect(await screen.findByText('Ana Ficticia')).toBeTruthy();
    expect(screen.getByText('ana@x.exemplo')).toBeTruthy();
    expect(screen.getByText('Quero estudar com o SIESAL.')).toBeTruthy();
    expect(screen.getByText(/2/)).toBeTruthy();
    const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations).toEqual([]);
  });

  it('aprovar pede confirmação, chama a decisão e tira o pedido da fila', async () => {
    const { decidir } = montar();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Aprovar o pedido de Ana Ficticia' }));
    expect(screen.getByText('Aprovar e enviar o convite por e-mail?')).toBeTruthy();
    expect(decidir).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Sim, aprovar' }));
    await waitFor(() => expect(decidir).toHaveBeenCalledWith(PEDIDOS[0], 'aprovar'));
    expect(
      await screen.findByText(
        /Convite enviado por e-mail para Ana Ficticia. O pedido saiu da fila./,
      ),
    ).toBeTruthy();
    expect(screen.queryByText('ana@x.exemplo')).toBeNull();
  });

  it('L22j: depois de aprovar, mostra o código grande, a validade e os botões de copiar; passa no axe', async () => {
    const { container } = montar();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Aprovar o pedido de Ana Ficticia' }));
    await u.click(screen.getByRole('button', { name: 'Sim, aprovar' }));
    expect(await screen.findByRole('heading', { name: 'Convite de Ana Ficticia' })).toBeTruthy();
    expect(screen.getByText('ABCD-EFGH-JKLM-NPQR')).toBeTruthy();
    expect(screen.getByText('25/11/2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copiar o código' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copiar o link' })).toBeTruthy();
    const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations).toEqual([]);
  });

  it('L22j: recusar não mostra código', async () => {
    montar();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Recusar o pedido de Bia Ficticia' }));
    await u.click(screen.getByRole('button', { name: 'Sim, recusar' }));
    await screen.findByText(/sem o motivo/);
    expect(screen.queryByRole('button', { name: 'Copiar o código' })).toBeNull();
  });

  it('recusar avisa que a pessoa não recebe o motivo; "Não" cancela', async () => {
    const { decidir } = montar();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Recusar o pedido de Bia Ficticia' }));
    await u.click(screen.getByRole('button', { name: 'Não' }));
    expect(decidir).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Recusar o pedido de Bia Ficticia' }));
    await u.click(screen.getByRole('button', { name: 'Sim, recusar' }));
    await waitFor(() => expect(decidir).toHaveBeenCalledWith(PEDIDOS[1], 'recusar'));
    expect(await screen.findByText(/sem o motivo/)).toBeTruthy();
  });

  it('mostra o erro quando o e-mail falha e o pedido continua na fila', async () => {
    const decidir = vi.fn(async () => {
      throw new Error('falhou');
    });
    render(<PedidosConvite nivel="h2" carregar={async () => PEDIDOS} decidir={decidir} />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Aprovar o pedido de Ana Ficticia' }));
    await u.click(screen.getByRole('button', { name: 'Sim, aprovar' }));
    expect(await screen.findByText('Não foi possível concluir. Nada foi alterado.')).toBeTruthy();
    expect(screen.getByText('ana@x.exemplo')).toBeTruthy();
  });

  it('fila vazia diz que nenhum pedido espera', async () => {
    render(<PedidosConvite nivel="h1" carregar={async () => []} decidir={async () => undefined} />);
    expect(await screen.findByText('Nenhum pedido esperando.')).toBeTruthy();
  });
});
