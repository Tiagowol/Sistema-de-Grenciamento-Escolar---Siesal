// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContaDados } from './api';
import { Conta } from './paginas/Conta';

// L17c: tela Minha conta (senha, e-mail, suporte, encerrar), aluno menor e decisões do Responsável. Dados fictícios.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const semContraste = { rules: { 'color-contrast': { enabled: false } } };
const base: ContaDados = {
  conta: { nome: 'Pessoa Fictícia', email: 'pessoa@t.exemplo', perfil: 'professor', menor: false },
  pedidos: [],
  decisoes: [],
};

function simular(dados: ContaDados) {
  const chamadas: { metodo: string; url: string; corpo: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET';
      chamadas.push({
        metodo,
        url: url.replace('/api', ''),
        corpo: init?.body ? JSON.parse(String(init.body)) : null,
      });
      if (metodo === 'GET') return new Response(JSON.stringify(dados), { status: 200 });
      return new Response(JSON.stringify({ pedido: { id: 'p1' }, nivel: 'completo' }), {
        status: 201,
      });
    }),
  );
  return chamadas;
}

describe('tela Minha conta', () => {
  it('mostra os dados e as seções, sem violações do axe', async () => {
    simular(base);
    const { container } = render(<Conta aoSair={() => undefined} />);
    await screen.findByText('pessoa@t.exemplo');
    for (const nome of ['Trocar a senha', 'Trocar o e-mail', 'Pedir suporte', 'Encerrar a conta'])
      expect(screen.getByRole('heading', { name: nome })).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('aluno menor é avisado de que precisa do Responsável ou do Admin', async () => {
    simular({ ...base, conta: { ...base.conta, perfil: 'aluno', menor: true } });
    render(<Conta aoSair={() => undefined} />);
    await screen.findByText('pessoa@t.exemplo');
    expect(screen.getAllByText(/O seu Responsável ou o Admin precisa aprovar/).length).toBe(2);
  });

  it('pedido de e-mail exige senha; envia e-mail novo e senha', async () => {
    const chamadas = simular(base);
    render(<Conta aoSair={() => undefined} />);
    await screen.findByText('pessoa@t.exemplo');
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Pedir a troca de e-mail' }));
    expect(await screen.findByText('Escreva o e-mail novo.')).toBeTruthy();
    await u.type(screen.getByLabelText('E-mail novo'), 'novo@t.exemplo');
    await u.click(screen.getByRole('button', { name: 'Pedir a troca de e-mail' }));
    expect(await screen.findByText('Escreva a sua senha atual.')).toBeTruthy();
    await u.type(screen.getAllByLabelText('Sua senha atual')[0] as HTMLElement, 'senha-fake');
    await u.click(screen.getByRole('button', { name: 'Pedir a troca de e-mail' }));
    await waitFor(() => expect(chamadas.some((c) => c.url === '/conta/email')).toBe(true));
    expect(chamadas.find((c) => c.url === '/conta/email')?.corpo).toEqual({
      email_novo: 'novo@t.exemplo',
      senha_atual: 'senha-fake',
    });
  });

  it('pedido de adulto em andamento tem confirmar e cancelar; o de menor só cancelar', async () => {
    const pedido = {
      id: 'p1',
      tipo: 'encerramento' as const,
      email_novo: null,
      exige_aprovacao: false,
      dia: '2026-11-10',
    };
    simular({ ...base, pedidos: [pedido] });
    render(<Conta aoSair={() => undefined} />);
    await screen.findByRole('button', { name: 'Confirmar: encerrar minha conta' });
    expect(screen.getByRole('button', { name: 'Cancelar o pedido' })).toBeTruthy();
    cleanup();
    simular({
      ...base,
      conta: { ...base.conta, perfil: 'aluno', menor: true },
      pedidos: [{ ...pedido, exige_aprovacao: true }],
    });
    render(<Conta aoSair={() => undefined} />);
    await screen.findByText(/Esperando a aprovação do seu Responsável ou do Admin/);
    expect(screen.queryByRole('button', { name: /Confirmar/ })).toBeNull();
  });

  it('confirmar o encerramento chama a API e sai da conta', async () => {
    const aoSair = vi.fn();
    const chamadas = simular({
      ...base,
      pedidos: [
        {
          id: 'p1',
          tipo: 'encerramento',
          email_novo: null,
          exige_aprovacao: false,
          dia: '2026-11-10',
        },
      ],
    });
    render(<Conta aoSair={aoSair} />);
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Confirmar: encerrar minha conta' }));
    await waitFor(() => expect(aoSair).toHaveBeenCalledOnce());
    expect(chamadas.some((c) => c.url === '/conta/pedidos/p1/confirmar')).toBe(true);
  });

  it('o Responsável vê os pedidos do aluno e aprova ou recusa', async () => {
    const chamadas = simular({
      ...base,
      conta: { ...base.conta, perfil: 'responsavel' },
      decisoes: [
        {
          id: 'd1',
          tipo: 'email',
          email_novo: 'filho@t.exemplo',
          aluno_nome: 'Aluno Fictício',
          dia: '2026-11-10',
        },
      ],
    });
    render(<Conta aoSair={() => undefined} />);
    await screen.findByText('Aluno Fictício');
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /Aprovar/ }));
    await waitFor(() =>
      expect(chamadas.some((c) => c.url === '/conta/pedidos/d1/decidir')).toBe(true),
    );
    expect(chamadas.find((c) => c.url === '/conta/pedidos/d1/decidir')?.corpo).toEqual({
      aprovar: true,
    });
  });

  it('suporte: assunto por lista e texto; recusa texto vazio', async () => {
    const chamadas = simular(base);
    render(<Conta aoSair={() => undefined} />);
    await screen.findByText('pessoa@t.exemplo');
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    expect(await screen.findByText('Escreva o que aconteceu.')).toBeTruthy();
    await u.selectOptions(screen.getByLabelText('Assunto'), 'erro_na_tela');
    await u.type(screen.getByLabelText('O que aconteceu'), 'A tela não abre');
    await u.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    await screen.findByText('Pedido enviado. A equipe da escola vai ver.');
    expect(chamadas.find((c) => c.url === '/suporte')?.corpo).toEqual({
      assunto: 'erro_na_tela',
      texto: 'A tela não abre',
    });
  });
});
